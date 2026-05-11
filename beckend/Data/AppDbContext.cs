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

    public virtual DbSet<KanbanTask> Tasks { get; set; }

    public virtual DbSet<TaskFeedback> TaskFeedbacks { get; set; }

    public virtual DbSet<UserStat> UserStats { get; set; }

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
#warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see https://go.microsoft.com/fwlink/?LinkId=723263.
        => optionsBuilder.UseSqlServer("Server=DESKTOP-0GOH1AC\\SQLEXPRESS01;Database=GROWTY;Trusted_Connection=True;TrustServerCertificate=True");

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

            entity.HasOne(d => d.Board).WithMany(p => p.BoardTasks).HasForeignKey(d => d.BoardId);
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
