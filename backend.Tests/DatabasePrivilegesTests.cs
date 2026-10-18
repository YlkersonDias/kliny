using System.Net.Http.Json;
using MySqlConnector;

namespace Backend.Tests;

// Se estes testes falharem, o usuário de teste ganhou privilégio demais, e os outros deixaram de
// provar que o app funciona só com DML.
public class DatabasePrivilegesTests(MySqlApi api) : IClassFixture<MySqlApi>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<MySqlException> RunAsAppUser(string sql)
    {
        await using var connection = new MySqlConnection(api.AppConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new MySqlCommand(sql, connection);
        return await Assert.ThrowsAsync<MySqlException>(() => command.ExecuteNonQueryAsync(Ct));
    }

    [Theory]
    [InlineData("CREATE TABLE Intrusa (Id int)")]
    [InlineData("DROP TABLE Transactions")]
    [InlineData("ALTER TABLE Users ADD COLUMN Intrusa int")]
    [InlineData("CREATE INDEX IX_Intruso ON Users (Name)")]
    [InlineData("TRUNCATE TABLE Categories")]
    public async Task Usuario_da_api_nao_altera_a_estrutura(string sql)
    {
        var error = await RunAsAppUser(sql);

        Assert.Contains(error.ErrorCode, new[]
        {
            MySqlErrorCode.TableAccessDenied,
            MySqlErrorCode.DatabaseAccessDenied,
        });
    }

    [Fact]
    public async Task Usuario_da_api_nao_enxerga_outros_bancos()
    {
        var error = await RunAsAppUser("SELECT COUNT(*) FROM mysql.user");

        Assert.Equal(MySqlErrorCode.TableAccessDenied, error.ErrorCode);
    }

    [Fact]
    public async Task Api_funciona_so_com_DML()
    {
        var token = await api.RegisterAsync("dml@kliny.test");
        using var client = api.Client(token);

        using var income = await client.PostAsync("/api/transactions",
            Json("""{"description":"Saldo inicial","amount":100,"date":"2021-05-01"}"""), Ct);
        using var vault = await client.PostAsync("/api/vaults", Json("""{"name":"Reserva"}"""), Ct);
        var vaultId = (await vault.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>(Ct)).GetProperty("id").GetInt32();
        using var deposit = await client.PostAsync($"/api/vaults/{vaultId}/deposit",
            Json("""{"amount":40,"date":"2021-05-02"}"""), Ct);

        Assert.Equal(System.Net.HttpStatusCode.Created, income.StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.Created, vault.StatusCode);
        Assert.Equal(System.Net.HttpStatusCode.OK, deposit.StatusCode);
    }

    private static StringContent Json(string body) => new(body, System.Text.Encoding.UTF8, "application/json");
}
