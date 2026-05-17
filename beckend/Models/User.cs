using System;
using System.Collections.Generic;

namespace beckend.Models;

public partial class User
{
    public int Id { get; set; }

    public string Email { get; set; } = null!;

    public string DisplayName { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<Board> Boards { get; set; } = new List<Board>();

    public virtual ICollection<TaskFeedback> TaskFeedbacks { get; set; } = new List<TaskFeedback>();

    public virtual ICollection<KanbanTask> Tasks { get; set; } = new List<KanbanTask>();

    public virtual ICollection<UserStat> UserStats { get; set; } = new List<UserStat>();
}
