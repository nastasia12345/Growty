using beckend.Data;
using beckend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace beckend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FeedbackController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly int _tempUserId = 1;

        public FeedbackController(AppDbContext context) => _context = context;

        [HttpPost("task/{taskId}")]
        public async Task<IActionResult> AddFeedback(int taskId, [FromBody] FeedbackDto dto)
        {
            var feedback = new TaskFeedback
            {
                TaskId = taskId,
                Comment = dto.Comment,
                DifficultyRating = dto.Rating,
                UserId = _tempUserId
            };
            _context.TaskFeedbacks.Add(feedback);
            await _context.SaveChangesAsync();
            return Ok(feedback);
        }

        [HttpGet("task/{taskId}")]
        public async Task<IActionResult> GetFeedback(int taskId)
        {
            var feedback = await _context.TaskFeedbacks
                .Where(f => f.TaskId == taskId && f.UserId == _tempUserId)
                .OrderByDescending(f => f.CreatedAt)
                .FirstOrDefaultAsync();
            return Ok(feedback);
        }
    }

    public class FeedbackDto
    {
        public string? Comment { get; set; }
        public int Rating { get; set; }
    }
}