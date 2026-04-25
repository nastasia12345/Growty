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
            private readonly string _tempUserId = "temp-user";

            public BoardsController(AppDbContext context)
            {
                _context = context;
            }

            [HttpGet]
            public async Task<IActionResult> GetBoards()
            {
                var boards = await _context.Boards
                    .Include(b => b.Tasks)
                    .Where(b => b.UserId == _tempUserId)
                    .ToListAsync();

                return Ok(boards);
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
                var board = await _context.Boards.FirstOrDefaultAsync(b => b.Id == id && b.UserId == _tempUserId);
                if (board == null) return NotFound();
                board.Title = updated.Title;
                board.Description = updated.Description;
                await _context.SaveChangesAsync();
                return Ok(board);
            }

            [HttpDelete("{id}")]
            public async Task<IActionResult> DeleteBoard(int id)
            {
                var board = await _context.Boards.FirstOrDefaultAsync(b => b.Id == id && b.UserId == _tempUserId);
                if (board == null) return NotFound();
                _context.Boards.Remove(board);
                await _context.SaveChangesAsync();
                return Ok();
            }
        }
    
}
