using System.Collections.Generic;
using System.Threading.Tasks;

namespace beckend.Services
{
    public interface IAIService
    {
        Task<AISuggestionResult> ImproveTaskDescription(string originalDescription, string taskTitle);
        Task<List<string>> GenerateSubtasks(string taskDescription);
    }

    public class AISuggestionResult
    {
        public string ImprovedText { get; set; } = null!;
        public List<string> GeneratedSubtasks { get; set; } = new();
        public int Confidence { get; set; }
    }
}