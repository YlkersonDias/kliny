using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MySqlConnector;

namespace Backend.Tests;

// Excluir a própria conta (POST /api/auth/delete-account): exige a senha atual, apaga todos os
// dados da pessoa (inclusive cofres com histórico, que esbarrariam no RESTRICT da chave estrangeira)
// e nada de outra pessoa. 4 cadastros nesta classe, dentro do limite de 5 por hora por IP.
public class AccountDeletionTests(MySqlApi api) : IClassFixture<MySqlApi>
{
    private const string Password = "senha12345";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // Uma categoria com orçamento, uma recorrência já gerada, uma compra parcelada, uma regra de categoria, uma receita com categoria, um cofre com depósito e retirada (histórico).
    private async Task<(string Token, int UserId)> SeedAsync(string email)
    {
        var token = await api.RegisterAsync(email);
        using var client = api.Client(token);
        var category = await IdOf(client.PostAsJsonAsync("/api/categories", new { name = "Mercado" }, Ct));
        await IdOf(client.PostAsJsonAsync("/api/transactions",
            new { description = "Salário", amount = 900m, date = "2021-05-01", categoryId = category }, Ct));
        using (var budget = await client.PutAsJsonAsync($"/api/budgets/{category}", new { amount = 500m }, Ct))
            budget.EnsureSuccessStatusCode();
        // Recorrência com uma ocorrência já gerada (a movimentação aponta para a regra).
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await IdOf(client.PostAsJsonAsync("/api/recurrences",
            new { description = "Aluguel", amount = -100m, startDate = today.ToString("yyyy-MM-dd"), categoryId = category }, Ct));
        (await client.PostAsJsonAsync("/api/recurrences/sync", new { today = today.ToString("yyyy-MM-dd") }, Ct)).EnsureSuccessStatusCode();
        await IdOf(client.PostAsJsonAsync($"/api/installments?today={today:yyyy-MM-dd}",
            new { description = "Geladeira", total = 300m, count = 3, firstDate = today.ToString("yyyy-MM-dd"), categoryId = category }, Ct));
        await IdOf(client.PostAsJsonAsync("/api/category-rules", new { pattern = "mercado", categoryId = category }, Ct));
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

    // Linhas da pessoa em cada tabela, lidas direto no banco (usuário só de DML da API, sem o filtro global).
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

        // Senha errada: 400 e nada apagado.
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

        // O token de A deixa de valer, o de B continua.
        using (var clientA = api.Client(tokenA))
        using (var meA = await clientA.GetAsync("/api/auth/me", Ct))
            Assert.Equal(HttpStatusCode.Unauthorized, meA.StatusCode);
        using (var clientB = api.Client(tokenB))
        using (var meB = await clientB.GetAsync("/api/auth/me", Ct))
            Assert.Equal(HttpStatusCode.OK, meB.StatusCode);

        // Login de A recusado, e o e-mail fica livre para um cadastro novo, vazio.
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

        // Bloqueado: nem a senha certa passa até o bloqueio acabar.
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
