using System;
using System.Collections.Generic;

namespace beckend.Models;

public partial class UserStat
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public DateTime Date { get; set; }

    public int TasksCreated { get; set; }

    public int TasksCompleted { get; set; }

    public int TasksOverdue { get; set; }

    public int ActivityScore { get; set; }

    public int ActiveMinutes { get; set; }

    public virtual User User { get; set; } = null!;
}
