namespace beckend.Models;

public class GoogleToken
{
    public int Id { get; set; }
    public int UserId { get; set; } = 1;
    public string AccessToken { get; set; } = "";
    public string? RefreshToken { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;
}
