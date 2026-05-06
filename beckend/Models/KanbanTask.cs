namespace beckend.Models
{
    public class KanbanTask
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime? Deadline { get; set; }
        public string Priority { get; set; } = "Medium";
        public string Status { get; set; } = "ToDo";
        public int BoardId { get; set; }
        public Board? Board { get; set; }
        public int UserId { get; set; } = 1;
        public DateTime? CompletedAt { get; set; }
    }
}
