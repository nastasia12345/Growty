using beckend.Data;
using beckend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace beckend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AnalyticsController : ControllerBase
    {
        private readonly IStatisticsService _statsService;
        private readonly AppDbContext _context;
        private readonly int _tempUserId = 1;

        public AnalyticsController(IStatisticsService statsService, AppDbContext context)
        {
            _statsService = statsService;
            _context = context;
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

        [HttpGet("tasks-by-status")]
        public async Task<IActionResult> GetTasksByStatus()
        {
            var tasks = await _context.Tasks
                .Where(t => t.UserId == _tempUserId)
                .GroupBy(t => t.Status)
                .Select(g => new { status = g.Key, count = g.Count() })
                .ToListAsync();

            var todo      = tasks.FirstOrDefault(x => x.status == "ToDo")?.count ?? 0;
            var inProgress = tasks.FirstOrDefault(x => x.status == "InProgress")?.count ?? 0;
            var done      = tasks.FirstOrDefault(x => x.status == "Done")?.count ?? 0;

            return Ok(new { todo, inProgress, done });
        }
    }
}
