using System;
using System.Collections.Generic;

namespace beckend.Models;

public partial class Board
{
    public int Id { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public int UserId { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual ICollection<KanbanTask> BoardTasks { get; set; } = new List<KanbanTask>();
}
