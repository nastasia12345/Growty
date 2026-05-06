using beckend.Data;
using beckend.Models;
using Microsoft.EntityFrameworkCore;

namespace beckend.Services
{
    public interface IStatisticsService
    {
        Task UpdateAfterTaskCreated(int userId, DateTime createdDate);
        Task UpdateAfterTaskCompleted(int userId, DateTime completedDate);
        Task UpdateOverdueStatsDaily();
        Task<UserStats[]> GetUserStats(int userId, DateTime from, DateTime to);
        Task<UserStats> GetOrCreateStats(int userId, DateTime date);
    }

    public class StatisticsService : IStatisticsService
    {
        private readonly AppDbContext _context;
        public StatisticsService(AppDbContext context) => _context = context;

        public async Task UpdateAfterTaskCreated(int userId, DateTime createdDate)
        {
            var date = createdDate.Date;
            var stats = await GetOrCreateStats(userId, date);
            stats.TasksCreated++;
            stats.ActivityScore = stats.TasksCreated + stats.TasksCompleted;
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAfterTaskCompleted(int userId, DateTime completedDate)
        {
            var date = completedDate.Date;
            var stats = await GetOrCreateStats(userId, date);
            stats.TasksCompleted++;
            stats.ActivityScore = stats.TasksCreated + stats.TasksCompleted;
            await _context.SaveChangesAsync();
        }

        public async Task UpdateOverdueStatsDaily()
        {
            var yesterday = DateTime.UtcNow.Date.AddDays(-1);
            var overdueTasks = await _context.Tasks
                .Where(t => t.Deadline.HasValue && t.Deadline.Value.Date == yesterday && t.Status != "Done")
                .GroupBy(t => t.UserId)
                .Select(g => new { UserId = g.Key, Count = g.Count() })
                .ToListAsync();

            foreach (var item in overdueTasks)
            {
                var stats = await GetOrCreateStats(item.UserId, yesterday);
                stats.TasksOverdue = item.Count;
                stats.ActivityScore = stats.TasksCreated + stats.TasksCompleted;
            }
            await _context.SaveChangesAsync();
        }

        public async Task<UserStats[]> GetUserStats(int userId, DateTime from, DateTime to)
        {
            return await _context.UserStats
                .Where(s => s.UserId == userId && s.Date >= from.Date && s.Date <= to.Date)
                .OrderBy(s => s.Date)
                .ToArrayAsync();
        }

        public async Task<UserStats> GetOrCreateStats(int userId, DateTime date)
        {
            var stats = await _context.UserStats.FirstOrDefaultAsync(s => s.UserId == userId && s.Date == date);
            if (stats == null)
            {
                stats = new UserStats { UserId = userId, Date = date };
                _context.UserStats.Add(stats);
            }
            return stats;
        }
    }
}