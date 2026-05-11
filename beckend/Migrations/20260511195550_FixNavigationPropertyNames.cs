using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace beckend.Migrations
{
    /// <inheritdoc />
    public partial class FixNavigationPropertyNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent: create User table only if it doesn't already exist
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[User]', 'U') IS NULL
                BEGIN
                    CREATE TABLE [User] (
                        [Id] int NOT NULL IDENTITY,
                        [Email] nvarchar(max) NOT NULL,
                        [DisplayName] nvarchar(max) NOT NULL,
                        [PasswordHash] nvarchar(max) NOT NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        CONSTRAINT [PK_User] PRIMARY KEY ([Id])
                    );
                END
            ");

            // Idempotent: create GamificationState table only if it doesn't exist
            migrationBuilder.Sql(@"
                IF OBJECT_ID(N'[GamificationState]', 'U') IS NULL
                BEGIN
                    CREATE TABLE [GamificationState] (
                        [Id] int NOT NULL IDENTITY,
                        [UserId] int NOT NULL,
                        [HealthLevel] int NOT NULL,
                        [InactiveDays] int NOT NULL,
                        [LastActivityDate] date NULL,
                        [UpdatedAt] datetime2 NOT NULL,
                        CONSTRAINT [PK_GamificationState] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_GamificationState_User_UserId] FOREIGN KEY ([UserId]) REFERENCES [User] ([Id]) ON DELETE CASCADE
                    );
                END
            ");

            // Seed default user with Id=1 so existing FK data is valid
            migrationBuilder.Sql(@"
                SET IDENTITY_INSERT [User] ON;
                IF NOT EXISTS (SELECT 1 FROM [User] WHERE [Id] = 1)
                BEGIN
                    INSERT INTO [User] ([Id], [Email], [DisplayName], [PasswordHash], [CreatedAt])
                    VALUES (1, 'admin@growty.com', 'Admin', 'placeholder', GETUTCDATE());
                END
                SET IDENTITY_INSERT [User] OFF;
            ");

            // Idempotent index creation
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserStats_UserId' AND object_id = OBJECT_ID('UserStats'))
                CREATE INDEX [IX_UserStats_UserId] ON [UserStats] ([UserId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_UserId' AND object_id = OBJECT_ID('Tasks'))
                CREATE INDEX [IX_Tasks_UserId] ON [Tasks] ([UserId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TaskFeedbacks_UserId' AND object_id = OBJECT_ID('TaskFeedbacks'))
                CREATE INDEX [IX_TaskFeedbacks_UserId] ON [TaskFeedbacks] ([UserId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Boards_UserId' AND object_id = OBJECT_ID('Boards'))
                CREATE INDEX [IX_Boards_UserId] ON [Boards] ([UserId]);");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_GamificationState_UserId' AND object_id = OBJECT_ID('GamificationState'))
                CREATE UNIQUE INDEX [IX_GamificationState_UserId] ON [GamificationState] ([UserId]);");

            // FK constraints — use NO ACTION to avoid multiple cascade path errors in SQL Server
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Boards_User_UserId')
                ALTER TABLE [Boards] ADD CONSTRAINT [FK_Boards_User_UserId] FOREIGN KEY ([UserId]) REFERENCES [User] ([Id]) ON DELETE NO ACTION;");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_TaskFeedbacks_User_UserId')
                ALTER TABLE [TaskFeedbacks] ADD CONSTRAINT [FK_TaskFeedbacks_User_UserId] FOREIGN KEY ([UserId]) REFERENCES [User] ([Id]) ON DELETE NO ACTION;");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Tasks_User_UserId')
                ALTER TABLE [Tasks] ADD CONSTRAINT [FK_Tasks_User_UserId] FOREIGN KEY ([UserId]) REFERENCES [User] ([Id]) ON DELETE NO ACTION;");

            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserStats_User_UserId')
                ALTER TABLE [UserStats] ADD CONSTRAINT [FK_UserStats_User_UserId] FOREIGN KEY ([UserId]) REFERENCES [User] ([Id]) ON DELETE NO ACTION;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Boards_User_UserId')
                ALTER TABLE [Boards] DROP CONSTRAINT [FK_Boards_User_UserId];");

            migrationBuilder.Sql(@"IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_TaskFeedbacks_User_UserId')
                ALTER TABLE [TaskFeedbacks] DROP CONSTRAINT [FK_TaskFeedbacks_User_UserId];");

            migrationBuilder.Sql(@"IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Tasks_User_UserId')
                ALTER TABLE [Tasks] DROP CONSTRAINT [FK_Tasks_User_UserId];");

            migrationBuilder.Sql(@"IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_UserStats_User_UserId')
                ALTER TABLE [UserStats] DROP CONSTRAINT [FK_UserStats_User_UserId];");

            migrationBuilder.Sql(@"IF OBJECT_ID(N'[GamificationState]', 'U') IS NOT NULL DROP TABLE [GamificationState];");
            migrationBuilder.Sql(@"IF OBJECT_ID(N'[User]', 'U') IS NOT NULL DROP TABLE [User];");

            migrationBuilder.Sql(@"IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserStats_UserId') DROP INDEX [IX_UserStats_UserId] ON [UserStats];");
            migrationBuilder.Sql(@"IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tasks_UserId') DROP INDEX [IX_Tasks_UserId] ON [Tasks];");
            migrationBuilder.Sql(@"IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TaskFeedbacks_UserId') DROP INDEX [IX_TaskFeedbacks_UserId] ON [TaskFeedbacks];");
            migrationBuilder.Sql(@"IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Boards_UserId') DROP INDEX [IX_Boards_UserId] ON [Boards];");
        }
    }
}
