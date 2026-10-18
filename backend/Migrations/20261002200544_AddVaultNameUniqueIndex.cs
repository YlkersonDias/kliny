using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kliny.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddVaultNameUniqueIndex : Migration
    {
        // Ordem dos índices ajustada à mão: o MySQL não deixa apagar o índice usado pela
        // chave estrangeira Vaults.UserId sem outro que comece por UserId já existir.

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Vaults_UserId_Name",
                table: "Vaults",
                columns: new[] { "UserId", "Name" },
                unique: true);

            migrationBuilder.DropIndex(
                name: "IX_Vaults_UserId",
                table: "Vaults");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Vaults_UserId",
                table: "Vaults",
                column: "UserId");

            migrationBuilder.DropIndex(
                name: "IX_Vaults_UserId_Name",
                table: "Vaults");
        }
    }
}
