using beckend.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System;
using System.Threading;
using System.Threading.Tasks;

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
            }
        }
    }
}