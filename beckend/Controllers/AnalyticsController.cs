using Microsoft.AspNetCore.Mvc;
using beckend.Services;

namespace beckend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AnalyticsController : ControllerBase
    {
        private readonly IStatisticsService _statsService;
        private readonly int _tempUserId = 1;

        public AnalyticsController(IStatisticsService statsService)
        {
            _statsService = statsService;
        }

        [HttpGet("stats")]
        public async Task<IActionResult> GetStats([FromQuery] int days = 30)
        {
            var from = DateTime.UtcNow.AddDays(-days).Date;
            var to = DateTime.UtcNow.Date;
            var stats = await _statsService.GetUserStats(_tempUserId, from, to);
            return Ok(stats);
        }

        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            var stats = await _statsService.GetUserStats(_tempUserId, DateTime.UtcNow.AddDays(-30), DateTime.UtcNow);
            return Ok(new
            {
                totalCompleted = stats.Sum(s => s.TasksCompleted),
                totalOverdue = stats.Sum(s => s.TasksOverdue),
                totalCreated = stats.Sum(s => s.TasksCreated)
            });
        }
    }
}