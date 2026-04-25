using beckend.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddControllers()
.AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler =
        ReferenceHandler.IgnoreCycles;
});

var app = builder.Build();

// 🔁 ВАЖЛИВО: порядок має бути такий:
app.UseRouting();          // 1. Спочатку маршрутизація
app.UseCors("AllowAll");   // 2. Потім CORS (до Authorization)
app.UseHttpsRedirection(); // 3. Потім перенаправлення HTTPS
app.UseAuthorization();    // 4. Потім авторизація
app.MapControllers();      // 5. І нарешті маппінг контролерів

app.Run();