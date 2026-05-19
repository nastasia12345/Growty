using Microsoft.AspNetCore.Mvc;
using System.Text;
using System.Text.Json;

namespace beckend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class WellbeingController : ControllerBase
    {
        private const string Model  = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
        private const string ApiUrl = "https://router.huggingface.co/together/v1/chat/completions";

        private readonly IHttpClientFactory _http;
        private readonly string _token;

        public WellbeingController(IHttpClientFactory http, IConfiguration cfg)
        {
            _http  = http;
            _token = cfg["HuggingFace:ApiToken"] ?? "";
        }

        // ── POST /api/wellbeing/questions ──────────────────────────────────
        [HttpPost("questions")]
        public async Task<IActionResult> GenerateQuestions([FromBody] QuestionRequest req)
        {
            var period = req.Period?.ToLower() ?? "general";

            var categoriesHint = period switch
            {
                "morning" => "mood, sleep, energy, motivation, plans",
                "evening" => "day_summary, stress, productivity, emotions, wellbeing",
                _         => "mood, energy, stress, emotions, wellbeing"
            };

            var timeContext = period switch
            {
                "morning" => "morning (the user just woke up)",
                "evening" => "evening (the user is winding down after their day)",
                _         => "general check-in"
            };

            var systemPrompt = $$"""
You are a warm, empathetic wellbeing coach for Growty, a productivity app with a plant-growth theme.
Generate exactly 5 short, friendly wellbeing survey questions for a {{timeContext}}.
Use these 5 categories in order: {{categoriesHint}}.

Return ONLY a valid JSON array:
[
  {"id":1,"text":"<question>","category":"<category>"},
  ...
]

Rules:
- Warm, caring, conversational tone
- Max 12 words per question
- Each question targets one category
- No yes/no questions — all are "how/what" feeling questions
- Reference plants, growth, nature gently if natural
""";

            var userPrompt = $"Generate 5 {period} wellbeing questions. Return only valid JSON array.";

            try
            {
                var raw = await CallLlm(systemPrompt, userPrompt, 300);
                var questions = ParseQuestions(raw);
                return Ok(new { questions });
            }
            catch (Exception ex)
            {
                // Graceful fallback — never block the user
                return Ok(new { questions = FallbackQuestions(period) });
            }
        }

        // ── POST /api/wellbeing/quote ──────────────────────────────────────
        [HttpPost("quote")]
        public async Task<IActionResult> GenerateQuote([FromBody] QuoteRequest req)
        {
            var summary = req.Answers != null
                ? string.Join(", ", req.Answers.Select(a => $"{a.Category}: {a.Label}"))
                : "mixed responses";

            var systemPrompt = """
You are a warm, supportive coach for Growty app, which uses a plant-growth metaphor.
The user just completed a short wellbeing survey. Generate one personalized motivational quote.

Rules:
- Max 20 words
- Warm, specific to their mood
- Reference growth, nature, plants gently if it fits
- Ends with a positive action nudge
- No quotation marks around the response
- Return ONLY the quote text, nothing else
""";

            var userPrompt = $"User survey summary: {summary}\n\nWrite one short motivational quote.";

            try
            {
                var quote = (await CallLlm(systemPrompt, userPrompt, 80)).Trim().Trim('"');
                return Ok(new { quote });
            }
            catch
            {
                return Ok(new { quote = FallbackQuote(req.Answers) });
            }
        }

        // ── POST /api/wellbeing/plant-message ─────────────────────────────────
        [HttpPost("plant-message")]
        public async Task<IActionResult> GeneratePlantMessage([FromBody] PlantMsgRequest req)
        {
            var context = req.Context?.ToLower() ?? "general";
            var completed = req.CompletedToday;

            var contextHint = context switch
            {
                "after_task"  => $"The user just finished a task — they've completed {completed} task(s) today. Celebrate!",
                "no_tasks"    => "The user hasn't completed any tasks today. Be gentle, warm and encouraging.",
                "morning"     => "It's morning. Give the user a warm energising nudge to start their day.",
                "evening"     => "It's evening. Acknowledge their day and wish them a restful wind-down.",
                _             => "Give the user a short, warm motivational boost to keep growing."
            };

            var systemPrompt = """
You are a friendly, cute living plant companion inside Growty, a productivity app.
Speak in first-person as the plant — cheerful, warm, a little playful.
Generate ONE short message (max 14 words).
Reference growth, nature or plants only if it feels natural.
Return ONLY the message text. No quotes, no explanations.
""";

            var userPrompt = $"Context: {contextHint}\nWrite one short plant-companion message.";

            try
            {
                var msg = (await CallLlm(systemPrompt, userPrompt, 60)).Trim().Trim('"').Trim('\'');
                return Ok(new { message = msg });
            }
            catch
            {
                return Ok(new { message = FallbackPlantMessage(context, completed) });
            }
        }

        // ── Internal helpers ───────────────────────────────────────────────

        private async Task<string> CallLlm(string system, string user, int maxTokens)
        {
            var client = _http.CreateClient();
            if (!string.IsNullOrEmpty(_token))
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_token}");

            var body = new
            {
                model    = Model,
                messages = new[]
                {
                    new { role = "system", content = system },
                    new { role = "user",   content = user   }
                },
                max_tokens  = maxTokens,
                temperature = 0.75   // higher creativity for varied questions
            };

            var resp = await client.PostAsync(ApiUrl,
                new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json"));
            resp.EnsureSuccessStatusCode();

            using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
            return doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "";
        }

        private static List<object> ParseQuestions(string raw)
        {
            var s = raw.IndexOf('[');
            var e = raw.LastIndexOf(']');
            if (s < 0 || e < s) return FallbackQuestions("general").Cast<object>().ToList();

            var arr = JsonDocument.Parse(raw[s..(e + 1)]).RootElement;
            return arr.EnumerateArray().Select(q => (object)new
            {
                id       = q.TryGetProperty("id",       out var id)  ? id.GetInt32()    : 0,
                text     = q.TryGetProperty("text",     out var tx)  ? tx.GetString()   : "",
                category = q.TryGetProperty("category", out var cat) ? cat.GetString()  : "general"
            }).ToList();
        }

        private static List<object> FallbackQuestions(string period) =>
            period == "evening"
                ? new List<object>
                {
                    new { id=1, text="How would you describe your day overall?",          category="day_summary" },
                    new { id=2, text="How manageable was your stress today?",             category="stress" },
                    new { id=3, text="How productive did you feel today?",                category="productivity" },
                    new { id=4, text="How are your emotions settling as the day ends?",   category="emotions" },
                    new { id=5, text="How is your overall sense of wellbeing right now?", category="wellbeing" }
                }
                : new List<object>
                {
                    new { id=1, text="How is your mood feeling this morning?",            category="mood" },
                    new { id=2, text="How well did you sleep last night?",                category="sleep" },
                    new { id=3, text="How is your energy level right now?",               category="energy" },
                    new { id=4, text="How motivated do you feel to tackle today?",        category="motivation" },
                    new { id=5, text="How clear do you feel about your plans today?",     category="plans" }
                };

        private static string FallbackQuote(List<AnswerItem>? answers)
        {
            var avg = answers?.Count > 0
                ? answers.Average(a => (double)a.Score)
                : 3.0;

            return avg >= 4
                ? "You're blooming beautifully — keep nurturing that energy! 🌻"
                : avg >= 3
                ? "Every day is a new chance to grow. You've got this! 🌱"
                : "Even the smallest seed grows in time. Be gentle with yourself today. 🌿";
        }

        private static readonly string[] PlantFallbacks =
        [
            "You're doing great — keep growing! 🌱",
            "One step at a time, we'll bloom together! 🌿",
            "I believe in you! Let's make today count! 🌻",
            "Small steps still move you forward! 💚",
            "You've got this — I'm rooting for you! 🪴",
            "Every moment is a chance to grow a little more! 🌸",
        ];

        private static string FallbackPlantMessage(string context, int completed)
        {
            if (context == "after_task")
                return $"Amazing — {completed} task{(completed != 1 ? "s" : "")} done today! You're blooming! 🌻";
            if (context == "no_tasks")
                return "Even on slow days, your roots are growing stronger. 🌿";
            var rng = new Random();
            return PlantFallbacks[rng.Next(PlantFallbacks.Length)];
        }
    }

    // ── Request / response models ──────────────────────────────────────────────

    public class QuestionRequest
    {
        public string? Period { get; set; }
    }

    public class QuoteRequest
    {
        public List<AnswerItem>? Answers { get; set; }
    }

    public class PlantMsgRequest
    {
        public string? Context        { get; set; }
        public int     CompletedToday { get; set; }
    }

    public class AnswerItem
    {
        public string Category { get; set; } = "";
        public string Label    { get; set; } = "";
        public int    Score    { get; set; }
    }
}
