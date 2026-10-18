using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MySqlConnector;

namespace Kliny.Api.Tests;

public class AccountDeletionTests(MySqlApi api) : IClassFixture<MySqlApi>
{
    private const string Password = "senha12345";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<(string Token, int UserId)> SeedAsync(string email)
    {
        var token = await api.RegisterAsync(email);
        using var client = api.Client(token);
        var category = await IdOf(client.PostAsJsonAsync("/api/categories", new { name = "Mercado" }, Ct));
        await IdOf(client.PostAsJsonAsync("/api/transactions",
            new { description = "Salário", amount = 900m, date = "2021-05-01", categoryId = category }, Ct));
        using (var budget = await client.PutAsJsonAsync($"/api/budgets/{category}", new { amount = 500m }, Ct))
            budget.EnsureSuccessStatusCode();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await IdOf(client.PostAsJsonAsync("/api/recurrences",
            new { description = "Aluguel", amount = -100m, startDate = today.ToString("yyyy-MM-dd"), categoryId = category }, Ct));
        (await client.PostAsJsonAsync("/api/recurrences/sync", new { today = today.ToString("yyyy-MM-dd") }, Ct)).EnsureSuccessStatusCode();
        await IdOf(client.PostAsJsonAsync($"/api/installments?today={today:yyyy-MM-dd}",
            new { description = "Geladeira", total = 300m, count = 3, firstDate = today.ToString("yyyy-MM-dd"), categoryId = category }, Ct));
        await IdOf(client.PostAsJsonAsync("/api/category-rules", new { pattern = "mercado", categoryId = category }, Ct));
        (await client.PostAsJsonAsync("/api/imports", new
        {
            lines = new[] { new { source = "341:0001", externalId = "F1", date = "2021-05-04", amount = -12m, description = "Importada", occurrence = 1 } },
        }, Ct)).EnsureSuccessStatusCode();
        var vault = await IdOf(client.PostAsJsonAsync("/api/vaults", new { name = "Reserva", goal = 300m }, Ct));
        (await client.PostAsJsonAsync($"/api/vaults/{vault}/deposit", new { amount = 200m, date = "2021-05-02" }, Ct)).EnsureSuccessStatusCode();
        (await client.PostAsJsonAsync($"/api/vaults/{vault}/withdraw", new { amount = 50m, date = "2021-05-03" }, Ct)).EnsureSuccessStatusCode();
        var userId = (await client.GetFromJsonAsync<JsonElement>("/api/auth/me", Ct)).GetProperty("id").GetInt32();
        return (token, userId);
    }

    private static async Task<int> IdOf(Task<HttpResponseMessage> request)
    {
        using var response = await request;
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
    }

    private async Task<HttpResponseMessage> DeleteAsync(string token, string password)
    {
        using var client = api.Client(token);
        return await client.PostAsJsonAsync("/api/auth/delete-account", new { password }, Ct);
    }

    // Direto no banco, sem o filtro global.
    private async Task<Dictionary<string, long>> RowsAsync(int userId)
    {
        await using var connection = new MySqlConnection(api.AppConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new MySqlCommand("""
            SELECT 'users', COUNT(*) FROM Users WHERE Id = @id
            UNION ALL SELECT 'categories', COUNT(*) FROM Categories WHERE UserId = @id
            UNION ALL SELECT 'vaults', COUNT(*) FROM Vaults WHERE UserId = @id
            UNION ALL SELECT 'budgets', COUNT(*) FROM Budgets WHERE UserId = @id
            UNION ALL SELECT 'recurrences', COUNT(*) FROM Recurrences WHERE UserId = @id
            UNION ALL SELECT 'installments', COUNT(*) FROM InstallmentPlans WHERE UserId = @id
            UNION ALL SELECT 'rules', COUNT(*) FROM CategoryRules WHERE UserId = @id
            UNION ALL SELECT 'transactions', COUNT(*) FROM Transactions WHERE UserId = @id
            """, connection);
        command.Parameters.AddWithValue("@id", userId);
        var rows = new Dictionary<string, long>();
        await using var reader = await command.ExecuteReaderAsync(Ct);
        while (await reader.ReadAsync(Ct))
            rows[reader.GetString(0)] = reader.GetInt64(1);
        return rows;
    }

    [Fact]
    public async Task Exclui_todos_os_dados_da_pessoa_e_nada_de_outra()
    {
        var (tokenA, userA) = await SeedAsync("excluir-a@kliny.test");
        var (tokenB, userB) = await SeedAsync("excluir-b@kliny.test");
        var rowsOfB = await RowsAsync(userB);

        using (var wrong = await DeleteAsync(tokenA, "senha-errada"))
        {
            Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
            Assert.Equal("Senha incorreta.", (await wrong.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("detail").GetString());
        }
        Assert.Equal(1, (await RowsAsync(userA))["users"]);

        using (var deleted = await DeleteAsync(tokenA, Password))
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        Assert.All(await RowsAsync(userA), row => Assert.Equal(0, row.Value));
        Assert.Equal(rowsOfB, await RowsAsync(userB));

        using (var clientA = api.Client(tokenA))
        using (var meA = await clientA.GetAsync("/api/auth/me", Ct))
            Assert.Equal(HttpStatusCode.Unauthorized, meA.StatusCode);
        using (var clientB = api.Client(tokenB))
        using (var meB = await clientB.GetAsync("/api/auth/me", Ct))
            Assert.Equal(HttpStatusCode.OK, meB.StatusCode);

        using (var anonymous = api.Client())
        using (var login = await anonymous.PostAsJsonAsync("/api/auth/login", new { email = "excluir-a@kliny.test", password = Password }, Ct))
            Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        var again = await api.RegisterAsync("excluir-a@kliny.test");
        using var newClient = api.Client(again);
        var list = await newClient.GetFromJsonAsync<JsonElement>("/api/transactions", Ct);
        Assert.Equal(0, list.GetProperty("totalCount").GetInt32());
    }

    [Fact]
    public async Task Senhas_erradas_seguidas_bloqueiam_como_no_login()
    {
        var token = await api.RegisterAsync("excluir-c@kliny.test");

        for (var i = 0; i < 5; i++)
        {
            using var wrong = await DeleteAsync(token, "senha-errada");
            Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        }

        using var blocked = await DeleteAsync(token, Password);
        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        using var client = api.Client(token);
        using var me = await client.GetAsync("/api/auth/me", Ct);
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
    }

    [Fact]
    public async Task Sem_senha_responde_400()
    {
        using var client = api.Client(await api.RegisterAsync("excluir-d@kliny.test"));

        using var response = await client.PostAsJsonAsync("/api/auth/delete-account", new { password = "" }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
