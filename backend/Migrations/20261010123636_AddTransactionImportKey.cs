using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kliny.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTransactionImportKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImportKey",
                table: "Transactions",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_Transactions_UserId_ImportKey",
                table: "Transactions",
                columns: new[] { "UserId", "ImportKey" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Transactions_UserId_ImportKey",
                table: "Transactions");

            migrationBuilder.DropColumn(
                name: "ImportKey",
                table: "Transactions");
        }
    }
}
