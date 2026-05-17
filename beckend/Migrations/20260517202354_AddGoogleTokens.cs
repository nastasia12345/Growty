using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace beckend.Migrations
{
    /// <inheritdoc />
    public partial class AddGoogleTokens : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_GamificationStates_UserId",
                table: "GamificationStates");

            migrationBuilder.CreateTable(
                name: "GoogleTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    AccessToken = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RefreshToken = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ConnectedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoogleTokens", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GoogleTokens");

            migrationBuilder.CreateIndex(
                name: "IX_GamificationStates_UserId",
                table: "GamificationStates",
                column: "UserId",
                unique: true);
        }
    }
}
