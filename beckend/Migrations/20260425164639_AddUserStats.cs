using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace beckend.Migrations
{
    /// <inheritdoc />
    public partial class AddUserStats : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserStats",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TasksCreated = table.Column<int>(type: "int", nullable: false),
                    TasksCompleted = table.Column<int>(type: "int", nullable: false),
                    TasksOverdue = table.Column<int>(type: "int", nullable: false),
                    ActivityScore = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserStats", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserStats");
        }
    }
}
