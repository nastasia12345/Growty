using beckend.Models;
using Microsoft.EntityFrameworkCore;

namespace beckend.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }
        public DbSet<Board> Boards { get; set; }
        public DbSet<KanbanTask> Tasks { get; set; }
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Board>()
                .HasMany(b => b.Tasks)
                .WithOne(t => t.Board)
                .HasForeignKey(t => t.BoardId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
