using System;
using System.Collections.Generic;

namespace beckend.Models;

public partial class GamificationState
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public int HealthLevel { get; set; }

    public int InactiveDays { get; set; }

    public DateOnly? LastActivityDate { get; set; }

    public DateTime UpdatedAt { get; set; }
}
