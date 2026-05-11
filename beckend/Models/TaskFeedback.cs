using System;
using System.Collections.Generic;

namespace beckend.Models;

public partial class TaskFeedback
{
    public int Id { get; set; }

    public int TaskId { get; set; }

    public string? Comment { get; set; }

    public int DifficultyRating { get; set; }

    public DateTime CreatedAt { get; set; }

    public int UserId { get; set; }

    public virtual KanbanTask? Task { get; set; }
}
