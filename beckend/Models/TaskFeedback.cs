namespace beckend.Models
{
    public class TaskFeedback
    {
        public int Id { get; set; }
        public int TaskId { get; set; }
        public KanbanTask? Task { get; set; }
        public string? Comment { get; set; }
        public int DifficultyRating { get; set; } // 1-5 зірки
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public int UserId { get; set; } = 1;
    }
}
