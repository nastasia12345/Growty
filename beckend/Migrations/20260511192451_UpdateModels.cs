using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace beckend.Migrations
{
    /// <inheritdoc />
    public partial class UpdateModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Change UserId from nvarchar to int in Tasks (safe)
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns c
                    JOIN sys.objects o ON c.object_id = o.object_id
                    WHERE o.name = 'Tasks' AND c.name = 'UserId' AND c.system_type_id = 231
                )
                BEGIN
                    DECLARE @v1 nvarchar(max);
                    SELECT @v1 = QUOTENAME(d.name)
                    FROM sys.default_constraints d
                    INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
                    WHERE d.parent_object_id = OBJECT_ID(N'[Tasks]') AND c.name = N'UserId';
                    IF @v1 IS NOT NULL EXEC(N'ALTER TABLE [Tasks] DROP CONSTRAINT ' + @v1);
                    ALTER TABLE [Tasks] ALTER COLUMN [UserId] int NOT NULL;
                END
            ");

            // Change UserId from nvarchar to int in Boards (safe)
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns c
                    JOIN sys.objects o ON c.object_id = o.object_id
                    WHERE o.name = 'Boards' AND c.name = 'UserId' AND c.system_type_id = 231
                )
                BEGIN
                    DECLARE @v2 nvarchar(max);
                    SELECT @v2 = QUOTENAME(d.name)
                    FROM sys.default_constraints d
                    INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
                    WHERE d.parent_object_id = OBJECT_ID(N'[Boards]') AND c.name = N'UserId';
                    IF @v2 IS NOT NULL EXEC(N'ALTER TABLE [Boards] DROP CONSTRAINT ' + @v2);
                    ALTER TABLE [Boards] ALTER COLUMN [UserId] int NOT NULL;
                END
            ");

            // Change UserId from nvarchar to int in TaskFeedbacks (safe)
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns c
                    JOIN sys.objects o ON c.object_id = o.object_id
                    WHERE o.name = 'TaskFeedbacks' AND c.name = 'UserId' AND c.system_type_id = 231
                )
                BEGIN
                    DECLARE @v3 nvarchar(max);
                    SELECT @v3 = QUOTENAME(d.name)
                    FROM sys.default_constraints d
                    INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
                    WHERE d.parent_object_id = OBJECT_ID(N'[TaskFeedbacks]') AND c.name = N'UserId';
                    IF @v3 IS NOT NULL EXEC(N'ALTER TABLE [TaskFeedbacks] DROP CONSTRAINT ' + @v3);
                    ALTER TABLE [TaskFeedbacks] ALTER COLUMN [UserId] int NOT NULL;
                END
            ");

            // Change UserId from nvarchar to int in UserStats (safe)
            migrationBuilder.Sql(@"
                IF EXISTS (
                    SELECT 1 FROM sys.columns c
                    JOIN sys.objects o ON c.object_id = o.object_id
                    WHERE o.name = 'UserStats' AND c.name = 'UserId' AND c.system_type_id = 231
                )
                BEGIN
                    DECLARE @v4 nvarchar(max);
                    SELECT @v4 = QUOTENAME(d.name)
                    FROM sys.default_constraints d
                    INNER JOIN sys.columns c ON d.parent_column_id = c.column_id AND d.parent_object_id = c.object_id
                    WHERE d.parent_object_id = OBJECT_ID(N'[UserStats]') AND c.name = N'UserId';
                    IF @v4 IS NOT NULL EXEC(N'ALTER TABLE [UserStats] DROP CONSTRAINT ' + @v4);
                    ALTER TABLE [UserStats] ALTER COLUMN [UserId] int NOT NULL;
                END
            ");

            // Add ActiveMinutes to UserStats if it doesn't exist
            migrationBuilder.Sql(@"
                IF NOT EXISTS (
                    SELECT 1 FROM sys.columns c
                    JOIN sys.objects o ON c.object_id = o.object_id
                    WHERE o.name = 'UserStats' AND c.name = 'ActiveMinutes'
                )
                BEGIN
                    ALTER TABLE [UserStats] ADD [ActiveMinutes] int NOT NULL DEFAULT 0;
                END
            ");

            // Create Aisuggestions table if it doesn't exist
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[Aisuggestions]') AND type = 'U')
                BEGIN
                    CREATE TABLE [Aisuggestions] (
                        [Id] int NOT NULL IDENTITY(1,1),
                        [TaskId] int NULL,
                        [OriginalText] nvarchar(max) NOT NULL,
                        [ImprovedText] nvarchar(max) NOT NULL,
                        [GeneratedSubtasks] nvarchar(max) NULL,
                        [CreatedAt] datetime2 NOT NULL,
                        CONSTRAINT [PK_Aisuggestions] PRIMARY KEY ([Id]),
                        CONSTRAINT [FK_Aisuggestions_Tasks_TaskId] FOREIGN KEY ([TaskId])
                            REFERENCES [Tasks] ([Id]) ON DELETE SET NULL
                    );
                    CREATE INDEX [IX_Aisuggestions_TaskId] ON [Aisuggestions] ([TaskId]);
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[Aisuggestions]')) DROP TABLE [Aisuggestions];");

            migrationBuilder.Sql(@"
                IF EXISTS (SELECT 1 FROM sys.columns c JOIN sys.objects o ON c.object_id = o.object_id WHERE o.name = 'UserStats' AND c.name = 'ActiveMinutes')
                    ALTER TABLE [UserStats] DROP COLUMN [ActiveMinutes];
            ");
        }
    }
}
