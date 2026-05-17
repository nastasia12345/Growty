using beckend.Data;
using beckend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace beckend.Controllers;

[Route("api/google-calendar")]
[ApiController]
public class GoogleCalendarController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpFactory;
    private const int TempUserId = 1;

    public GoogleCalendarController(AppDbContext context, IConfiguration config, IHttpClientFactory httpFactory)
    {
        _context = context;
        _config = config;
        _httpFactory = httpFactory;
    }

    private string ClientId     => _config["Google:ClientId"] ?? "";
    private string ClientSecret => _config["Google:ClientSecret"] ?? "";
    private string RedirectUri  => "http://localhost:5000/api/google-calendar/callback";
    private string FrontendUrl  => "http://localhost:4200/calendar";

    // ── GET /api/google-calendar/auth-url ────────────────────────────────────
    [HttpGet("auth-url")]
    public IActionResult GetAuthUrl()
    {
        if (string.IsNullOrWhiteSpace(ClientId))
            return BadRequest(new
            {
                error = "Google OAuth credentials are not configured. " +
                        "Add \"Google\": { \"ClientId\": \"...\", \"ClientSecret\": \"...\" } to appsettings.json."
            });

        var scope = Uri.EscapeDataString(
            "https://www.googleapis.com/auth/calendar " +
            "https://www.googleapis.com/auth/calendar.events");

        var url = "https://accounts.google.com/o/oauth2/v2/auth" +
                  $"?client_id={Uri.EscapeDataString(ClientId)}" +
                  $"&redirect_uri={Uri.EscapeDataString(RedirectUri)}" +
                  "&response_type=code" +
                  $"&scope={scope}" +
                  "&access_type=offline" +
                  "&prompt=consent";

        return Ok(new { url });
    }

    // ── GET /api/google-calendar/callback ────────────────────────────────────
    [HttpGet("callback")]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? error)
    {
        if (!string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code))
            return Redirect($"{FrontendUrl}?gcal_error=access_denied");

        var http = _httpFactory.CreateClient();
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"]          = code,
            ["client_id"]     = ClientId,
            ["client_secret"] = ClientSecret,
            ["redirect_uri"]  = RedirectUri,
            ["grant_type"]    = "authorization_code"
        });

        var resp = await http.PostAsync("https://oauth2.googleapis.com/token", form);
        if (!resp.IsSuccessStatusCode)
            return Redirect($"{FrontendUrl}?gcal_error=token_exchange_failed");

        var json   = await resp.Content.ReadAsStringAsync();
        var tokens = JsonSerializer.Deserialize<JsonElement>(json);

        var accessToken  = tokens.GetProperty("access_token").GetString() ?? "";
        var refreshToken = tokens.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn    = tokens.TryGetProperty("expires_in",    out var ei) ? ei.GetInt32() : 3600;

        var existing = await _context.GoogleTokens.FirstOrDefaultAsync(t => t.UserId == TempUserId);
        if (existing != null)
        {
            existing.AccessToken = accessToken;
            existing.ExpiresAt   = DateTime.UtcNow.AddSeconds(expiresIn);
            if (!string.IsNullOrEmpty(refreshToken)) existing.RefreshToken = refreshToken;
        }
        else
        {
            _context.GoogleTokens.Add(new GoogleToken
            {
                UserId       = TempUserId,
                AccessToken  = accessToken,
                RefreshToken = refreshToken,
                ExpiresAt    = DateTime.UtcNow.AddSeconds(expiresIn),
                ConnectedAt  = DateTime.UtcNow
            });
        }
        await _context.SaveChangesAsync();

        // Initial sync: push tasks that have deadlines to Google Calendar
        await SyncTasksToGoogleInternal(accessToken);

        return Redirect($"{FrontendUrl}?gcal=connected");
    }

    // ── GET /api/google-calendar/status ──────────────────────────────────────
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var token = await _context.GoogleTokens.FirstOrDefaultAsync(t => t.UserId == TempUserId);
        return Ok(new
        {
            connected    = token != null,
            connectedAt  = token?.ConnectedAt
        });
    }

    // ── DELETE /api/google-calendar/disconnect ────────────────────────────────
    [HttpDelete("disconnect")]
    public async Task<IActionResult> Disconnect()
    {
        var token = await _context.GoogleTokens.FirstOrDefaultAsync(t => t.UserId == TempUserId);
        if (token != null)
        {
            // Revoke token with Google
            try
            {
                var http = _httpFactory.CreateClient();
                await http.PostAsync($"https://oauth2.googleapis.com/revoke?token={token.AccessToken}",
                    new StringContent(""));
            }
            catch { /* ignore revoke errors */ }

            _context.GoogleTokens.Remove(token);
            await _context.SaveChangesAsync();
        }
        return Ok(new { disconnected = true });
    }

    // ── GET /api/google-calendar/events ──────────────────────────────────────
    [HttpGet("events")]
    public async Task<IActionResult> GetEvents()
    {
        var accessToken = await GetValidAccessToken();
        if (accessToken == null) return Unauthorized(new { error = "Not connected to Google Calendar" });

        var http    = _httpFactory.CreateClient();
        var timeMin = Uri.EscapeDataString(DateTime.UtcNow.AddMonths(-1).ToString("o"));
        var timeMax = Uri.EscapeDataString(DateTime.UtcNow.AddMonths(3).ToString("o"));
        var url = $"https://www.googleapis.com/calendar/v3/calendars/primary/events" +
                  $"?timeMin={timeMin}&timeMax={timeMax}&singleEvents=true&orderBy=startTime&maxResults=250";

        var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var resp = await http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
            return StatusCode((int)resp.StatusCode, new { error = "Failed to fetch Google Calendar events" });

        var json = await resp.Content.ReadAsStringAsync();
        var data = JsonSerializer.Deserialize<JsonElement>(json);

        var events = data.TryGetProperty("items", out var items)
            ? items.EnumerateArray().Select(e => new
            {
                id       = e.TryGetProperty("id",       out var id) ? id.GetString()      : null,
                title    = e.TryGetProperty("summary",  out var s)  ? s.GetString()       : "(no title)",
                start    = GetEventDate(e, "start"),
                end      = GetEventDate(e, "end"),
                allDay   = IsAllDay(e),
                htmlLink = e.TryGetProperty("htmlLink", out var l)  ? l.GetString()       : null,
                source   = e.TryGetProperty("description", out var d) && d.GetString()?.StartsWith("[Growty]") == true
                           ? "growty" : "google"
            }).ToList()
            : new();

        return Ok(events);
    }

    // ── POST /api/google-calendar/sync-tasks ──────────────────────────────────
    [HttpPost("sync-tasks")]
    public async Task<IActionResult> SyncTasks()
    {
        var accessToken = await GetValidAccessToken();
        if (accessToken == null) return Unauthorized(new { error = "Not connected to Google Calendar" });

        var synced = await SyncTasksToGoogleInternal(accessToken);
        return Ok(new { synced });
    }

    // ── POST /api/google-calendar/import-events ───────────────────────────────
    // Imports Google Calendar events as tasks in Growty
    [HttpPost("import-events")]
    public async Task<IActionResult> ImportEvents()
    {
        var accessToken = await GetValidAccessToken();
        if (accessToken == null) return Unauthorized(new { error = "Not connected to Google Calendar" });

        var http    = _httpFactory.CreateClient();
        var timeMin = Uri.EscapeDataString(DateTime.UtcNow.ToString("o"));
        var timeMax = Uri.EscapeDataString(DateTime.UtcNow.AddMonths(2).ToString("o"));
        var url = $"https://www.googleapis.com/calendar/v3/calendars/primary/events" +
                  $"?timeMin={timeMin}&timeMax={timeMax}&singleEvents=true&orderBy=startTime&maxResults=50";

        var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        var resp = await http.SendAsync(req);
        if (!resp.IsSuccessStatusCode) return StatusCode((int)resp.StatusCode);

        var json  = await resp.Content.ReadAsStringAsync();
        var data  = JsonSerializer.Deserialize<JsonElement>(json);
        int imported = 0;

        if (data.TryGetProperty("items", out var items))
        {
            foreach (var ev in items.EnumerateArray())
            {
                // Skip events already synced from Growty
                if (ev.TryGetProperty("description", out var desc) &&
                    desc.GetString()?.StartsWith("[Growty]") == true) continue;

                var title   = ev.TryGetProperty("summary", out var s) ? s.GetString() : null;
                if (string.IsNullOrWhiteSpace(title)) continue;

                var startStr = GetEventDate(ev, "start");
                DateTime? deadline = null;
                if (startStr != null && DateTime.TryParse(startStr, out var dt)) deadline = dt;

                // Don't import if a task with this title already exists
                var alreadyExists = await _context.Tasks
                    .AnyAsync(t => t.UserId == TempUserId && t.Title == title);
                if (alreadyExists) continue;

                // Find or create default board
                var board = await _context.Boards.FirstOrDefaultAsync(b => b.UserId == TempUserId)
                    ?? new Board
                    {
                        Title     = "My Board",
                        UserId    = TempUserId,
                        CreatedAt = DateTime.UtcNow
                    };

                if (board.Id == 0)
                {
                    _context.Boards.Add(board);
                    await _context.SaveChangesAsync();
                }

                _context.Tasks.Add(new KanbanTask
                {
                    Title       = title!,
                    Description = "Imported from Google Calendar",
                    Deadline    = deadline,
                    Priority    = "Medium",
                    Status      = "ToDo",
                    BoardId     = board.Id,
                    UserId      = TempUserId
                });
                imported++;
            }
            if (imported > 0) await _context.SaveChangesAsync();
        }

        return Ok(new { imported });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<int> SyncTasksToGoogleInternal(string accessToken)
    {
        var tasks = await _context.Tasks
            .Where(t => t.UserId == TempUserId && t.Status != "Done" && t.Deadline != null)
            .ToListAsync();

        var http    = _httpFactory.CreateClient();
        int created = 0;

        foreach (var task in tasks)
        {
            var deadline = task.Deadline!.Value;
            var body = new
            {
                summary     = task.Title,
                description = $"[Growty] Priority: {task.Priority}\n{task.Description ?? ""}".Trim(),
                start       = new { dateTime = deadline.ToString("o"), timeZone = "UTC" },
                end         = new { dateTime = deadline.AddHours(1).ToString("o"), timeZone = "UTC" },
                colorId     = task.Priority switch { "Critical" => "11", "High" => "6", "Medium" => "5", _ => "2" }
            };

            var req = new HttpRequestMessage(HttpMethod.Post,
                "https://www.googleapis.com/calendar/v3/calendars/primary/events");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            req.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

            var resp = await http.SendAsync(req);
            if (resp.IsSuccessStatusCode) created++;
        }

        return created;
    }

    private async Task<string?> GetValidAccessToken()
    {
        var token = await _context.GoogleTokens.FirstOrDefaultAsync(t => t.UserId == TempUserId);
        if (token == null) return null;

        // Token still valid (with 2-min buffer)
        if (token.ExpiresAt > DateTime.UtcNow.AddMinutes(2))
            return token.AccessToken;

        // Need to refresh
        if (string.IsNullOrEmpty(token.RefreshToken)) return null;

        var http = _httpFactory.CreateClient();
        var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["refresh_token"] = token.RefreshToken,
            ["client_id"]     = ClientId,
            ["client_secret"] = ClientSecret,
            ["grant_type"]    = "refresh_token"
        });

        var resp = await http.PostAsync("https://oauth2.googleapis.com/token", form);
        if (!resp.IsSuccessStatusCode) return null;

        var json      = await resp.Content.ReadAsStringAsync();
        var data      = JsonSerializer.Deserialize<JsonElement>(json);
        var newAccess = data.GetProperty("access_token").GetString() ?? "";
        var expiresIn = data.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600;

        token.AccessToken = newAccess;
        token.ExpiresAt   = DateTime.UtcNow.AddSeconds(expiresIn);
        await _context.SaveChangesAsync();

        return newAccess;
    }

    private static string? GetEventDate(JsonElement ev, string field)
    {
        if (!ev.TryGetProperty(field, out var obj)) return null;
        if (obj.TryGetProperty("dateTime", out var dt)) return dt.GetString();
        if (obj.TryGetProperty("date",     out var d))  return d.GetString();
        return null;
    }

    private static bool IsAllDay(JsonElement ev)
    {
        if (!ev.TryGetProperty("start", out var start)) return false;
        return start.TryGetProperty("date", out _) && !start.TryGetProperty("dateTime", out _);
    }
}
