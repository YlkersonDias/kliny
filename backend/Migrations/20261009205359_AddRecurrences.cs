using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddRecurrences : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RecurrenceId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Recurrences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: true),
                    StartDate = table.Column<DateOnly>(type: "date", nullable: false),
                    DayOfMonth = table.Column<int>(type: "int", nullable: false),
                    EndDate = table.Column<DateOnly>(type: "date", nullable: true),
                    NextDate = table.Column<DateOnly>(type: "date", nullable: false),
                    Paused = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Recurrences", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Recurrences_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Recurrences_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_RecurrenceId",
                table: "Transactions",
                column: "RecurrenceId");

            migrationBuilder.CreateIndex(
                name: "IX_Recurrences_CategoryId",
                table: "Recurrences",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Recurrences_UserId_NextDate",
                table: "Recurrences",
                columns: new[] { "UserId", "NextDate" });

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_Recurrences_RecurrenceId",
                table: "Transactions",
                column: "RecurrenceId",
                principalTable: "Recurrences",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transactions_Recurrences_RecurrenceId",
                table: "Transactions");

            migrationBuilder.DropTable(
                name: "Recurrences");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_RecurrenceId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "RecurrenceId",
                table: "Transactions");
        }
    }
}
