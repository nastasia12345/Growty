using System;
using System.Collections.Generic;

namespace beckend.Models;

public partial class KanbanTask
{
    public int Id { get; set; }

    public string Title { get; set; } = null!;

    public string? Description { get; set; }

    public DateTime? Deadline { get; set; }

    public string Priority { get; set; } = null!;

    public string Status { get; set; } = null!;

    public int BoardId { get; set; }

    public int UserId { get; set; }

    public DateTime? CompletedAt { get; set; }

    public string? Checklist { get; set; } // JSON: [{"text":"...","done":false}]

    public virtual ICollection<Aisuggestion> Aisuggestions { get; set; } = new List<Aisuggestion>();

    public virtual Board? Board { get; set; }

    public virtual ICollection<TaskFeedback> TaskFeedbacks { get; set; } = new List<TaskFeedback>();

    public virtual User? User { get; set; }
}
