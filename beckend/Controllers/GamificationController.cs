using beckend.Data;
using beckend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace beckend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class GamificationController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly int _tempUserId = 1;

        public GamificationController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("state")]
        public async Task<IActionResult> GetState()
        {
            var state = await EnsureState();

            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var daysSinceActivity = state.LastActivityDate.HasValue
                ? Math.Max(0, today.DayNumber - state.LastActivityDate.Value.DayNumber)
                : 99;

            var overdueCount = await _context.Tasks
                .Where(t => t.UserId == _tempUserId
                         && t.Status != "Done"
                         && t.Deadline != null
                         && t.Deadline < DateTime.UtcNow)
                .CountAsync();

            var wiltingLevel = daysSinceActivity >= 7 || state.HealthLevel <= 20 ? "critical"
                             : daysSinceActivity >= 3 || overdueCount >= 5       ? "moderate"
                             : overdueCount >= 2                                  ? "mild"
                             : "healthy";

            return Ok(new
            {
                healthLevel      = state.HealthLevel,
                inactiveDays     = daysSinceActivity,
                lastActivityDate = state.LastActivityDate,
                overdueCount,
                wiltingLevel,
                isWilting        = wiltingLevel != "healthy"
            });
        }

        // Called when user completes a task (triggered from frontend)
        [HttpPost("activity")]
        public async Task<IActionResult> RecordActivity()
        {
            var state = await EnsureState();
            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            // Only boost once per day
            if (state.LastActivityDate != today)
            {
                state.HealthLevel        = Math.Min(100, state.HealthLevel + 15);
                state.InactiveDays       = 0;
                state.LastActivityDate   = today;
                state.UpdatedAt          = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }

            return Ok(new { healthLevel = state.HealthLevel });
        }

        private async Task<GamificationState> EnsureState()
        {
            var state = await _context.GamificationStates
                .FirstOrDefaultAsync(g => g.UserId == _tempUserId);

            if (state != null) return state;

            state = new GamificationState
            {
                UserId           = _tempUserId,
                HealthLevel      = 100,
                InactiveDays     = 0,
                LastActivityDate = DateOnly.FromDateTime(DateTime.UtcNow),
                UpdatedAt        = DateTime.UtcNow
            };
            _context.GamificationStates.Add(state);
            await _context.SaveChangesAsync();
            return state;
        }
    }
}
