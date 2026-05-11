using beckend.Data;
using beckend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace beckend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TasksController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly int _tempUserId = 1;

        public TasksController(AppDbContext context) => _context = context;

        [HttpGet("board/{boardId}")]
        public async Task<IActionResult> GetTasksByBoard(int boardId)
        {
            var tasks = await _context.Tasks
                .Include(t => t.Board)  // ← Додайте це, якщо потрібен Board
                .Where(t => t.BoardId == boardId && t.UserId == _tempUserId)
                .ToListAsync();
            return Ok(tasks);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTask([FromBody] KanbanTask task)
        {
            task.UserId = _tempUserId;
            _context.Tasks.Add(task);
            await _context.SaveChangesAsync();
            return Ok(task);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTask(int id, [FromBody] KanbanTask updated)
        {
            var task = await _context.Tasks
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _tempUserId);

            if (task == null)
                return NotFound();

            task.Title = updated.Title;
            task.Description = updated.Description;
            task.Deadline = updated.Deadline;
            task.Priority = updated.Priority;
            task.Status = updated.Status;

            if (task.Status == "Done")
                task.CompletedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(task);
        }

        [HttpPatch("{id}/move")]
        public async Task<IActionResult> MoveTask(int id, [FromBody] string newStatus)
        {
            var task = await _context.Tasks
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _tempUserId);

            if (task == null)
                return NotFound();

            task.Status = newStatus;

            if (newStatus == "Done")
                task.CompletedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(task);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var task = await _context.Tasks
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _tempUserId);

            if (task == null)
                return NotFound();

            _context.Tasks.Remove(task);
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}