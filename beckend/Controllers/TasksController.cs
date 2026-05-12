using beckend.Data;
using beckend.Models;
using beckend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace beckend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TasksController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IStatisticsService _stats;
        private readonly int _tempUserId = 1;

        public TasksController(AppDbContext context, IStatisticsService stats)
        {
            _context = context;
            _stats   = stats;
        }

        [HttpGet("board/{boardId}")]
        public async Task<IActionResult> GetTasksByBoard(int boardId)
        {
            var tasks = await _context.Tasks
                .Where(t => t.BoardId == boardId && t.UserId == _tempUserId)
                .Select(t => new {
                    t.Id, t.Title, t.Description, t.Deadline,
                    t.Priority, t.Status, t.BoardId, t.UserId,
                    t.CompletedAt
                })
                .ToListAsync();
            return Ok(tasks);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTask([FromBody] KanbanTask task)
        {
            try
            {
                task.UserId = _tempUserId;
                _context.Tasks.Add(task);
                await _context.SaveChangesAsync();
                await _stats.UpdateAfterTaskCreated(_tempUserId, DateTime.UtcNow);
                return Ok(new {
                    task.Id, task.Title, task.Description, task.Deadline,
                    task.Priority, task.Status, task.BoardId, task.UserId,
                    task.CompletedAt
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTask(int id, [FromBody] KanbanTask updated)
        {
            try
            {
                var task = await _context.Tasks
                    .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _tempUserId);

                if (task == null)
                    return NotFound();

                var wasDone = task.Status == "Done";

                task.Title       = updated.Title;
                task.Description = updated.Description;
                task.Deadline    = updated.Deadline;
                task.Priority    = updated.Priority;
                task.Status      = updated.Status;

                if (!wasDone && task.Status == "Done")
                {
                    task.CompletedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                    await _stats.UpdateAfterTaskCompleted(_tempUserId, DateTime.UtcNow);
                }
                else
                {
                    if (task.Status != "Done") task.CompletedAt = null;
                    await _context.SaveChangesAsync();
                }

                return Ok(new {
                    task.Id, task.Title, task.Description, task.Deadline,
                    task.Priority, task.Status, task.BoardId, task.UserId,
                    task.CompletedAt
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPatch("{id}/move")]
        public async Task<IActionResult> MoveTask(int id, [FromBody] string newStatus)
        {
            var task = await _context.Tasks
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _tempUserId);

            if (task == null) return NotFound();

            var wasDone = task.Status == "Done";
            task.Status = newStatus;

            if (!wasDone && newStatus == "Done")
            {
                task.CompletedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                await _stats.UpdateAfterTaskCompleted(_tempUserId, DateTime.UtcNow);
            }
            else
            {
                if (newStatus != "Done") task.CompletedAt = null;
                await _context.SaveChangesAsync();
            }

            return Ok(task);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTask(int id)
        {
            var task = await _context.Tasks
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == _tempUserId);

            if (task == null) return NotFound();

            _context.Tasks.Remove(task);
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}
