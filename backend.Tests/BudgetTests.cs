using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Backend.Tests;

// Orçamento por categoria (8.2), contra o MySQL. Os dados são criados uma vez por classe
// (o cadastro tem limite por IP); cada teste usa categorias próprias.
public sealed class BudgetFixture : IAsyncLifetime
{
    public MySqlApi Api { get; } = new();
    public string Token { get; private set; } = "";
    public int Food { get; private set; }
    public int Rent { get; private set; }
    public int Free { get; private set; }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Api.InitializeAsync();
        if (!Api.IsAvailable)
            return;

        Token = await Api.RegisterAsync("orcamento@kliny.test");
        using var client = Api.Client(Token);
        Food = await IdOf(client.PostAsJsonAsync("/api/categories", new { name = "Alimentação" }, Ct));
        Rent = await IdOf(client.PostAsJsonAsync("/api/categories", new { name = "Moradia" }, Ct));
        Free = await IdOf(client.PostAsJsonAsync("/api/categories", new { name = "Lazer" }, Ct));

        // Outubro de 2021 em Alimentação: 120 + 30,50 de gastos; uma receita e um gasto de outro mês
        // na mesma categoria não contam.
        foreach (var (description, amount, date, category) in new (string, decimal, string, int?)[]
        {
            ("Mercado", -120.00m, "2021-10-03", Food),
            ("Padaria", -30.50m, "2021-10-31", Food),
            ("Reembolso", 50.00m, "2021-10-10", Food),
            ("Mercado setembro", -999.00m, "2021-09-30", Food),
            ("Mercado novembro", -999.00m, "2021-11-01", Food),
            ("Aluguel", -1500.00m, "2021-10-05", Rent),
            ("Salário", 4000.00m, "2021-10-01", null),
        })
        {
            using var response = await client.PostAsJsonAsync("/api/transactions",
                new { description, amount, date, categoryId = category }, Ct);
            response.EnsureSuccessStatusCode();
        }

        // Operação de cofre (sem categoria) também não conta.
        var vault = await IdOf(client.PostAsJsonAsync("/api/vaults", new { name = "Reserva" }, Ct));
        using var deposit = await client.PostAsJsonAsync($"/api/vaults/{vault}/deposit", new { amount = 100m, date = "2021-10-06" }, Ct);
        deposit.EnsureSuccessStatusCode();
    }

    public ValueTask DisposeAsync() => Api.DisposeAsync();

    private static async Task<int> IdOf(Task<HttpResponseMessage> request)
    {
        using var response = await request;
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
    }
}

public class BudgetTests(BudgetFixture fixture) : IClassFixture<BudgetFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Client() => fixture.Api.Client(fixture.Token);

    private async Task<JsonElement[]> ListAsync(string month)
    {
        using var client = Client();
        return (await client.GetFromJsonAsync<JsonElement>($"/api/budgets?month={month}", Ct)).EnumerateArray().ToArray();
    }

    private async Task<HttpResponseMessage> SetAsync(int categoryId, object amount)
    {
        using var client = Client();
        return await client.PutAsJsonAsync($"/api/budgets/{categoryId}", new { amount }, Ct);
    }

    [Fact]
    public async Task Cria_altera_e_remove_com_o_gasto_do_mes()
    {
        using (var created = await SetAsync(fixture.Food, 800m))
        {
            Assert.Equal(HttpStatusCode.OK, created.StatusCode);
            var body = await created.Content.ReadFromJsonAsync<JsonElement>(Ct);
            Assert.Equal(fixture.Food, body.GetProperty("categoryId").GetInt32());
            Assert.Equal(800m, body.GetProperty("limit").GetDecimal());
        }

        var food = Assert.Single(await ListAsync("2021-10"), b => b.GetProperty("categoryId").GetInt32() == fixture.Food);
        Assert.Equal("Alimentação", food.GetProperty("categoryName").GetString());
        Assert.Equal(800m, food.GetProperty("limit").GetDecimal());
        // Só os gastos de outubro: sem a receita, sem os outros meses e sem o depósito no cofre.
        Assert.Equal(150.50m, food.GetProperty("spent").GetDecimal());

        // Alterar não cria outro: continua um só.
        using (var changed = await SetAsync(fixture.Food, 100m))
            Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        food = Assert.Single(await ListAsync("2021-10"), b => b.GetProperty("categoryId").GetInt32() == fixture.Food);
        Assert.Equal(100m, food.GetProperty("limit").GetDecimal());

        // Mês sem gasto: gasto zero.
        food = Assert.Single(await ListAsync("2021-12"), b => b.GetProperty("categoryId").GetInt32() == fixture.Food);
        Assert.Equal(0m, food.GetProperty("spent").GetDecimal());

        using var client = Client();
        using (var deleted = await client.DeleteAsync($"/api/budgets/{fixture.Food}", Ct))
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.DoesNotContain(await ListAsync("2021-10"), b => b.GetProperty("categoryId").GetInt32() == fixture.Food);
        using var again = await client.DeleteAsync($"/api/budgets/{fixture.Food}", Ct);
        Assert.Equal(HttpStatusCode.NotFound, again.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    [InlineData(10.555)]
    public async Task Limite_invalido_responde_400(decimal amount)
    {
        using var response = await SetAsync(fixture.Free, amount);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("errors").TryGetProperty("Amount", out _));
    }

    [Fact]
    public async Task Categoria_inexistente_responde_404()
    {
        using var response = await SetAsync(999_999, 100m);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("2021-13")]
    [InlineData("2021-1")]
    [InlineData("outubro")]
    [InlineData("2021-10-01")]
    [InlineData("9999-12")]
    public async Task Mes_invalido_responde_400(string month)
    {
        using var client = Client();
        using var response = await client.GetAsync($"/api/budgets?month={month}", Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Apagar_a_categoria_apaga_o_orcamento()
    {
        using var client = Client();
        using var created = await client.PostAsJsonAsync("/api/categories", new { name = "Temporária" }, Ct);
        var category = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
        using (var set = await SetAsync(category, 50m))
            Assert.Equal(HttpStatusCode.OK, set.StatusCode);

        using (var deleted = await client.DeleteAsync($"/api/categories/{category}", Ct))
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        Assert.DoesNotContain(await ListAsync("2021-10"), b => b.GetProperty("categoryId").GetInt32() == category);
    }

    [Fact]
    public async Task Sem_login_responde_401()
    {
        using var anonymous = fixture.Api.Client();
        using var list = await anonymous.GetAsync("/api/budgets?month=2021-10", Ct);
        using var set = await anonymous.PutAsJsonAsync($"/api/budgets/{fixture.Rent}", new { amount = 10m }, Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, list.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, set.StatusCode);
    }
}
