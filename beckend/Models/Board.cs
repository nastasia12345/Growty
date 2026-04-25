namespace beckend.Models
{
   
        public class Board
        {
            public int Id { get; set; }
            public string Title { get; set; } = string.Empty;
            public string? Description { get; set; }
            public string UserId { get; set; } = "temp-user";
            public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
            public ICollection<KanbanTask> Tasks { get; set; } = new List<KanbanTask>();
        }
        
}
