using beckend.Data;
using beckend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace beckend.Controllers;

[Route("api/auth")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IConfiguration _config;

    public AuthController(AppDbContext context, IConfiguration config)
    {
        _context = context;
        _config = config;
    }

    // ── POST /api/auth/register ───────────────────────────────────────────
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) ||
            string.IsNullOrWhiteSpace(req.Password) ||
            string.IsNullOrWhiteSpace(req.DisplayName))
            return BadRequest(new { error = "Email, display name and password are required." });

        if (req.Password.Length < 6)
            return BadRequest(new { error = "Password must be at least 6 characters." });

        var exists = await _context.Users.AnyAsync(u => u.Email == req.Email.ToLower());
        if (exists)
            return Conflict(new { error = "An account with this email already exists." });

        var user = new User
        {
            Email        = req.Email.ToLower().Trim(),
            DisplayName  = req.DisplayName.Trim(),
            PasswordHash = HashPassword(req.Password),
            CreatedAt    = DateTime.UtcNow
        };
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        var token = GenerateJwt(user);
        return Ok(UserResponse(user, token));
    }

    // ── POST /api/auth/login ──────────────────────────────────────────────
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == req.Email.ToLower().Trim());

        if (user == null || !VerifyPassword(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "Incorrect email or password." });

        var token = GenerateJwt(user);
        return Ok(UserResponse(user, token));
    }

    // ── GET /api/auth/me ──────────────────────────────────────────────────
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var userId = GetUserIdFromToken();
        if (userId == null) return Unauthorized(new { error = "Not authenticated." });

        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null) return NotFound(new { error = "User not found." });

        return Ok(new
        {
            id          = user.Id,
            email       = user.Email,
            displayName = user.DisplayName,
            createdAt   = user.CreatedAt
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static string HashPassword(string password)
    {
        byte[] salt = RandomNumberGenerator.GetBytes(16);
        using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, 100_000, HashAlgorithmName.SHA256);
        byte[] hash = pbkdf2.GetBytes(32);
        byte[] combined = new byte[48];
        Buffer.BlockCopy(salt, 0, combined, 0, 16);
        Buffer.BlockCopy(hash, 0, combined, 16, 32);
        return Convert.ToBase64String(combined);
    }

    private static bool VerifyPassword(string password, string storedHash)
    {
        try
        {
            byte[] combined = Convert.FromBase64String(storedHash);
            byte[] salt = combined[..16];
            byte[] stored = combined[16..];
            using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, 100_000, HashAlgorithmName.SHA256);
            byte[] computed = pbkdf2.GetBytes(32);
            return CryptographicOperations.FixedTimeEquals(computed, stored);
        }
        catch { return false; }
    }

    private string GenerateJwt(User user)
    {
        var key    = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds  = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,   user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("displayName",                 user.DisplayName),
            new Claim(JwtRegisteredClaimNames.Jti,   Guid.NewGuid().ToString())
        };
        var token = new JwtSecurityToken(
            issuer:             _config["Jwt:Issuer"],
            audience:           _config["Jwt:Audience"],
            claims:             claims,
            expires:            DateTime.UtcNow.AddDays(30),
            signingCredentials: creds
        );
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private int? GetUserIdFromToken()
    {
        var authHeader = Request.Headers["Authorization"].FirstOrDefault();
        if (authHeader == null || !authHeader.StartsWith("Bearer ")) return null;
        var tokenStr = authHeader["Bearer ".Length..];
        try
        {
            var handler    = new JwtSecurityTokenHandler();
            var key        = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
            var parameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey         = key,
                ValidateIssuer           = true,
                ValidIssuer              = _config["Jwt:Issuer"],
                ValidateAudience         = true,
                ValidAudience            = _config["Jwt:Audience"],
                ValidateLifetime         = true
            };
            var principal = handler.ValidateToken(tokenStr, parameters, out _);
            var sub = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
            return sub != null ? int.Parse(sub) : null;
        }
        catch { return null; }
    }

    private static object UserResponse(User user, string token) => new
    {
        token,
        user = new
        {
            id          = user.Id,
            email       = user.Email,
            displayName = user.DisplayName,
            createdAt   = user.CreatedAt
        }
    };
}

public record RegisterRequest(string Email, string DisplayName, string Password);
public record LoginRequest(string Email, string Password);
