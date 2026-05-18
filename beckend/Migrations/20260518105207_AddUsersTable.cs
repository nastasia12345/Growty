using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace beckend.Migrations
{
    /// <inheritdoc />
    public partial class AddUsersTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Only create if it doesn't exist (safe to run multiple times)
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'Users' AND type = 'U')
                BEGIN
                    CREATE TABLE [Users] (
                        [Id]           int IDENTITY(1,1) NOT NULL,
                        [Email]        nvarchar(max) NOT NULL,
                        [DisplayName]  nvarchar(max) NOT NULL,
                        [PasswordHash] nvarchar(max) NOT NULL,
                        [CreatedAt]    datetime2 NOT NULL,
                        CONSTRAINT [PK_Users] PRIMARY KEY ([Id])
                    );
                END
            ");

            // Seed a default user with id=1 so existing tasks/boards still work
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM [Users] WHERE [Id] = 1)
                BEGIN
                    SET IDENTITY_INSERT [Users] ON;
                    INSERT INTO [Users] ([Id],[Email],[DisplayName],[PasswordHash],[CreatedAt])
                    VALUES (1,'default@growty.app','Default User','(no-password)',GETUTCDATE());
                    SET IDENTITY_INSERT [Users] OFF;
                END
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS [Users];");
        }
    }
}
