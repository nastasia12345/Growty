using beckend.Data;
using beckend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;

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
            // Перевірка чи існує задача
            var task = await _context.Tasks.FirstOrDefaultAsync(t => t.Id == taskId);
            if (task == null)
                return NotFound($"Task with ID {taskId} not found");

            // Валідація рейтингу
            if (dto.Rating < 1 || dto.Rating > 5)
                return BadRequest("Rating must be between 1 and 5");

            var feedback = new TaskFeedback
            {
                TaskId = taskId,
                Comment = dto.Comment ?? string.Empty,
                DifficultyRating = dto.Rating,
                UserId = _tempUserId,
                CreatedAt = DateTime.UtcNow  // ← Додайте це поле в модель TaskFeedback
            };

            _context.TaskFeedbacks.Add(feedback);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Feedback added successfully",
                feedback = feedback
            });
        }

        [HttpGet("task/{taskId}")]
        public async Task<IActionResult> GetFeedback(int taskId)
        {
            // Перевірка чи існує задача
            var taskExists = await _context.Tasks.AnyAsync(t => t.Id == taskId);
            if (!taskExists)
                return NotFound($"Task with ID {taskId} not found");

            var feedback = await _context.TaskFeedbacks
                .Where(f => f.TaskId == taskId && f.UserId == _tempUserId)
                .OrderByDescending(f => f.CreatedAt)
                .FirstOrDefaultAsync();

            if (feedback == null)
                return Ok(new { message = "No feedback found for this task", feedback = (object)null });

            return Ok(feedback);
        }

        [HttpGet("task/{taskId}/all")]
        public async Task<IActionResult> GetAllFeedback(int taskId)
        {
            var feedbackList = await _context.TaskFeedbacks
                .Where(f => f.TaskId == taskId && f.UserId == _tempUserId)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();

            return Ok(feedbackList);
        }

        [HttpPut("{feedbackId}")]
        public async Task<IActionResult> UpdateFeedback(int feedbackId, [FromBody] FeedbackDto dto)
        {
            var feedback = await _context.TaskFeedbacks
                .FirstOrDefaultAsync(f => f.Id == feedbackId && f.UserId == _tempUserId);

            if (feedback == null)
                return NotFound("Feedback not found");

            if (dto.Rating < 1 || dto.Rating > 5)
                return BadRequest("Rating must be between 1 and 5");

            feedback.Comment = dto.Comment ?? string.Empty;
            feedback.DifficultyRating = dto.Rating;
            // feedback.UpdatedAt = DateTime.UtcNow;  ← ВИДАЛІТЬ АБО ЗАКОМЕНТУЙТЕ цей рядок (поля UpdatedAt немає в моделі)

            await _context.SaveChangesAsync();
            return Ok(feedback);
        }

        [HttpDelete("{feedbackId}")]
        public async Task<IActionResult> DeleteFeedback(int feedbackId)
        {
            var feedback = await _context.TaskFeedbacks
                .FirstOrDefaultAsync(f => f.Id == feedbackId && f.UserId == _tempUserId);

            if (feedback == null)
                return NotFound("Feedback not found");

            _context.TaskFeedbacks.Remove(feedback);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Feedback deleted successfully" });
        }
    }

    public class FeedbackDto
    {
        [StringLength(500, ErrorMessage = "Comment cannot exceed 500 characters")]
        public string? Comment { get; set; }

        [Range(1, 5, ErrorMessage = "Rating must be between 1 and 5")]
        public int Rating { get; set; }
    }
}