using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kliny.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInstallmentPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "InstallmentPlanId",
                table: "Transactions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "InstallmentPlans",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "varchar(245)", maxLength: 245, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Total = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Count = table.Column<int>(type: "int", nullable: false),
                    FirstDate = table.Column<DateOnly>(type: "date", nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InstallmentPlans", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InstallmentPlans_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_InstallmentPlans_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_InstallmentPlanId",
                table: "Transactions",
                column: "InstallmentPlanId");

            migrationBuilder.CreateIndex(
                name: "IX_InstallmentPlans_CategoryId",
                table: "InstallmentPlans",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_InstallmentPlans_UserId_FirstDate",
                table: "InstallmentPlans",
                columns: new[] { "UserId", "FirstDate" });

            migrationBuilder.AddForeignKey(
                name: "FK_Transactions_InstallmentPlans_InstallmentPlanId",
                table: "Transactions",
                column: "InstallmentPlanId",
                principalTable: "InstallmentPlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Transactions_InstallmentPlans_InstallmentPlanId",
                table: "Transactions");

            migrationBuilder.DropTable(
                name: "InstallmentPlans");

            migrationBuilder.DropIndex(
                name: "IX_Transactions_InstallmentPlanId",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "InstallmentPlanId",
                table: "Transactions");
        }
    }
}
