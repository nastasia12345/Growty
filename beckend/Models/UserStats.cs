namespace beckend.Models
{
    public class UserStats
    {
        public int Id { get; set; }
        public int UserId { get; set; } = 1;
        public DateTime Date { get; set; }
        public int TasksCreated { get; set; }
        public int TasksCompleted { get; set; }
        public int TasksOverdue { get; set; }
        public int ActivityScore { get; set; } // сума створених+виконаних за день
    }
}
