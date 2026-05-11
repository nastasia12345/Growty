using beckend.Models;
using Microsoft.EntityFrameworkCore;

namespace beckend.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Board> Boards { get; set; }
        public DbSet<KanbanTask> Tasks { get; set; }  // ← Залишаємо Tasks
        public DbSet<TaskFeedback> TaskFeedbacks { get; set; }
        public DbSet<UserStat> UserStats { get; set; }
        public DbSet<Aisuggestion> Aisuggestions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // These types have no migration table — exclude from EF model
            modelBuilder.Ignore<User>();
            modelBuilder.Ignore<GamificationState>();

            modelBuilder.Entity<Board>()
                .HasMany(b => b.BoardTasks)
                .WithOne(t => t.Board)
                .HasForeignKey(t => t.BoardId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Aisuggestion>()
                .HasOne(a => a.KanbanTask)
                .WithMany(t => t.Aisuggestions)
                .HasForeignKey(a => a.TaskId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}