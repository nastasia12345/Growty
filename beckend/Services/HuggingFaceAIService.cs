using System.Text;
using System.Text.Json;

namespace beckend.Services
{
    public class HuggingFaceAIService : IAIService
    {
        private const string Model = "meta-llama/Llama-3.3-70B-Instruct-Turbo";
        private const string ApiUrl = "https://router.huggingface.co/together/v1/chat/completions";

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _apiToken;

        public HuggingFaceAIService(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _apiToken = configuration["HuggingFace:ApiToken"] ?? "";
        }

        public async Task<AISuggestionResult> ImproveTaskDescription(string originalDescription, string taskTitle)
        {
            var systemPrompt = "You are a project management assistant. Fix spelling and grammar in task titles and descriptions. Be concise and professional. Return a JSON object with keys: improvedText (string) and subtasks (array of 2-3 short action items).";
            var userPrompt = $"Task title: \"{taskTitle}\"\nDescription: \"{originalDescription}\"\n\nReturn only valid JSON, no explanation.";

            var raw = await CallApi(systemPrompt, userPrompt);
            return ParseResponse(raw, originalDescription);
        }

        public async Task<List<string>> GenerateSubtasks(string taskDescription)
        {
            var raw = await CallApi(
                "You are a project management assistant. Generate 3 short subtasks as a JSON string array.",
                $"Task: \"{taskDescription}\"\n\nReturn only a JSON array of strings.");

            try { return JsonSerializer.Deserialize<List<string>>(raw) ?? new(); }
            catch { return new(); }
        }

        private async Task<string> CallApi(string systemPrompt, string userPrompt, int retryCount = 0)
        {
            var client = _httpClientFactory.CreateClient();
            if (!string.IsNullOrEmpty(_apiToken))
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_apiToken}");

            var body = new
            {
                model = Model,
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                },
                max_tokens = 400,
                temperature = 0.3
            };

            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var response = await client.PostAsync(ApiUrl, content);

            if (response.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable && retryCount < 2)
            {
                await Task.Delay(3000);
                return await CallApi(systemPrompt, userPrompt, retryCount + 1);
            }

            response.EnsureSuccessStatusCode();
            var json = await response.Content.ReadAsStringAsync();

            using var doc = JsonDocument.Parse(json);
            return doc.RootElement
                .GetProperty("choices")[0]
                .GetProperty("message")
                .GetProperty("content")
                .GetString() ?? "";
        }

        private AISuggestionResult ParseResponse(string text, string fallback)
        {
            try
            {
                var start = text.IndexOf('{');
                var end = text.LastIndexOf('}');
                if (start >= 0 && end > start)
                {
                    var jsonSlice = text[start..(end + 1)];
                    var parsed = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(jsonSlice);
                    if (parsed != null)
                    {
                        var improved = parsed.TryGetValue("improvedText", out var t) ? t.GetString() ?? fallback : fallback;
                        var subtasks = new List<string>();
                        if (parsed.TryGetValue("subtasks", out var st) && st.ValueKind == JsonValueKind.Array)
                            subtasks = st.EnumerateArray().Select(x => x.GetString() ?? "").Where(s => s.Length > 0).ToList();
                        return new AISuggestionResult { ImprovedText = improved, GeneratedSubtasks = subtasks, Confidence = 85 };
                    }
                }
            }
            catch { }

            // Fallback: treat entire response as improved text
            var cleaned = text.Trim();
            return new AISuggestionResult
            {
                ImprovedText = cleaned.Length > 0 ? cleaned : fallback,
                GeneratedSubtasks = new List<string>(),
                Confidence = 60
            };
        }
    }
}
