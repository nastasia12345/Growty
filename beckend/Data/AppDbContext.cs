using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore;
using beckend.Models;

namespace beckend.Data;

public partial class AppDbContext : DbContext
{
    public AppDbContext()
    {
    }

    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Aisuggestion> Aisuggestions { get; set; }

    public virtual DbSet<Board> Boards { get; set; }

    public virtual DbSet<GamificationState> GamificationStates { get; set; }

    public virtual DbSet<GoogleToken> GoogleTokens { get; set; }

    public virtual DbSet<KanbanTask> Tasks { get; set; }

    public virtual DbSet<TaskFeedback> TaskFeedbacks { get; set; }

    public virtual DbSet<User> Users { get; set; }

    public virtual DbSet<UserStat> UserStats { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        if (!optionsBuilder.IsConfigured)
            optionsBuilder.UseSqlServer("Server=.;Database=GROWTY;Trusted_Connection=True;TrustServerCertificate=True");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Aisuggestion>(entity =>
        {
            entity.HasIndex(e => e.TaskId, "IX_Aisuggestions_TaskId");

            entity.HasOne(d => d.Task).WithMany(p => p.Aisuggestions)
                .HasForeignKey(d => d.TaskId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<KanbanTask>(entity =>
        {
            entity.HasIndex(e => e.BoardId, "IX_Tasks_BoardId");

            entity.HasOne(d => d.Board)
                  .WithMany(p => p.BoardTasks)
                  .HasForeignKey(d => d.BoardId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TaskFeedback>(entity =>
        {
            entity.HasIndex(e => e.TaskId, "IX_TaskFeedbacks_TaskId");

            entity.HasOne(d => d.Task).WithMany(p => p.TaskFeedbacks).HasForeignKey(d => d.TaskId);
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
