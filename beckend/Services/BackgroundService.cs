using beckend.Data;
using beckend.Models;
using Microsoft.EntityFrameworkCore;

namespace beckend.Services
{
    public class OverdueStatsBackgroundService : BackgroundService
    {
        private readonly IServiceProvider _services;
        public OverdueStatsBackgroundService(IServiceProvider services) => _services = services;

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                var now = DateTime.UtcNow;
                var nextRun = now.Date.AddDays(1);
                await Task.Delay(nextRun - now, stoppingToken);

                using var scope = _services.CreateScope();

                var statsService = scope.ServiceProvider.GetRequiredService<IStatisticsService>();
                await statsService.UpdateOverdueStatsDaily();

                var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await UpdateGamificationStates(context);
            }
        }

        private static async Task UpdateGamificationStates(AppDbContext context)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var states = await context.GamificationStates.ToListAsync();

            foreach (var state in states)
            {
                var lastActivity = state.LastActivityDate ?? today.AddDays(-1);
                var daysSince = today.DayNumber - lastActivity.DayNumber;

                if (daysSince <= 0) continue; // active today — no penalty

                state.InactiveDays = daysSince;

                // Health drains: -5 per inactive day, extra -3 per overdue task (max drain 30/day)
                var overdueCount = await context.Tasks
                    .Where(t => t.UserId == state.UserId
                             && t.Status != "Done"
                             && t.Deadline != null
                             && t.Deadline < DateTime.UtcNow)
                    .CountAsync();

                var drain = Math.Min(30, daysSince * 5 + overdueCount * 3);
                state.HealthLevel = Math.Max(10, state.HealthLevel - drain);
                state.UpdatedAt   = DateTime.UtcNow;
            }

            await context.SaveChangesAsync();
        }
    }
}
