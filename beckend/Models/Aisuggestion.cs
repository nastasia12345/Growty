using System;
using System.Collections.Generic;

namespace beckend.Models;

public partial class Aisuggestion
{
    public int Id { get; set; }

    public int? TaskId { get; set; }

    public string OriginalText { get; set; } = null!;

    public string ImprovedText { get; set; } = null!;

    public string? GeneratedSubtasks { get; set; }

    public DateTime CreatedAt { get; set; }

    public virtual KanbanTask? Task { get; set; }
}
