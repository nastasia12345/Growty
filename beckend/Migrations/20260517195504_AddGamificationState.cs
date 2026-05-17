using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace beckend.Migrations
{
    /// <inheritdoc />
    public partial class AddGamificationState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GamificationStates",
                columns: table => new
                {
                    Id             = table.Column<int>(type: "int", nullable: false)
                                         .Annotation("SqlServer:Identity", "1, 1"),
                    UserId         = table.Column<int>(type: "int", nullable: false),
                    HealthLevel    = table.Column<int>(type: "int", nullable: false),
                    InactiveDays   = table.Column<int>(type: "int", nullable: false),
                    LastActivityDate = table.Column<DateOnly>(type: "date", nullable: true),
                    UpdatedAt      = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GamificationStates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GamificationStates_UserId",
                table: "GamificationStates",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "GamificationStates");
        }
    }
}
