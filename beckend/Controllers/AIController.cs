using beckend.Data;
using beckend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace beckend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AIController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IAIService _aiService;
        private readonly int _tempUserId = 1;

        public AIController(AppDbContext context, IAIService aiService)
        {
            _context = context;
            _aiService = aiService;
        }

        [HttpPost("improve-task/{taskId}")]
        public async Task<IActionResult> ImproveTaskDescription(int taskId)
        {
            var task = await _context.Tasks
                .FirstOrDefaultAsync(t => t.Id == taskId && t.UserId == _tempUserId);

            if (task == null)
                return NotFound();

            try
            {
                var suggestion = await _aiService.ImproveTaskDescription(
                    task.Description ?? "",
                    task.Title);

                return Ok(new
                {
                    suggestionId = 0,
                    improvedText = suggestion.ImprovedText,
                    subtasks = suggestion.GeneratedSubtasks,
                    confidence = suggestion.Confidence
                });
            }
            catch (HttpRequestException ex)
            {
                return StatusCode(502, new { error = "AI service unavailable", detail = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "AI request failed", detail = ex.Message });
            }
        }
    }
}