using beckend.Data;
using beckend.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace beckend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class BoardsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly int _tempUserId = 1;

        public BoardsController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetBoards()
        {
            try
            {
                // Тимчасово без Include, тільки дошки
                var boards = await _context.Boards
                     .Include(b => b.BoardTasks)
                    .Where(b => b.UserId == _tempUserId)
                    .ToListAsync();

                return Ok(boards);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message, stack = ex.StackTrace });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetBoard(int id)
        {
            try
            {
                var board = await _context.Boards
                    .Include(b => b.BoardTasks)
                    .FirstOrDefaultAsync(b => b.Id == id && b.UserId == _tempUserId);

                if (board == null)
                    return NotFound();

                return Ok(board);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateBoard([FromBody] Board board)
        {
            board.UserId = _tempUserId;
            board.CreatedAt = DateTime.UtcNow;
            _context.Boards.Add(board);
            await _context.SaveChangesAsync();
            return Ok(board);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateBoard(int id, [FromBody] Board updated)
        {
            var board = await _context.Boards
                .FirstOrDefaultAsync(b => b.Id == id && b.UserId == _tempUserId);

            if (board == null)
                return NotFound();

            board.Title = updated.Title;
            board.Description = updated.Description;
            await _context.SaveChangesAsync();
            return Ok(board);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBoard(int id)
        {
            var board = await _context.Boards
                .Include(b => b.BoardTasks)
                .FirstOrDefaultAsync(b => b.Id == id && b.UserId == _tempUserId);

            if (board == null)
                return NotFound();

            _context.Tasks.RemoveRange(board.BoardTasks);
            _context.Boards.Remove(board);
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}