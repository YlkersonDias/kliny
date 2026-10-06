using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Backend.Tests;

// Dados de A e B criados uma vez por execução (o cadastro tem limite de 5 por hora por IP).
// Datas no passado: depósito e retirada não aceitam data futura.
public sealed class OwnershipFixture : IAsyncLifetime
{
    public MySqlApi Api { get; } = new();

    public string TokenA { get; private set; } = "";
    public string TokenB { get; private set; } = "";
    public int CategoryA { get; private set; }
    public int TransactionA { get; private set; }
    public int VaultA { get; private set; }
    public int VaultTransactionA { get; private set; }
    public int TransactionB { get; private set; }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Api.InitializeAsync();
        if (!Api.IsAvailable)
            return;

        TokenA = await Api.RegisterAsync("a@kliny.test");
        TokenB = await Api.RegisterAsync("b@kliny.test");

        using var a = Api.Client(TokenA);
        CategoryA = await IdOf(a.PostAsJsonAsync("/api/categories", new { name = "Mercado A" }, Ct));
        TransactionA = await IdOf(a.PostAsJsonAsync("/api/transactions",
            new { description = "Salário A", amount = 1000.00m, date = "2020-01-10", categoryId = CategoryA }, Ct));
        VaultA = await IdOf(a.PostAsJsonAsync("/api/vaults", new { name = "Viagem A", goal = 500.00m }, Ct));
        using var deposit = await a.PostAsJsonAsync($"/api/vaults/{VaultA}/deposit",
            new { amount = 100.00m, date = "2020-01-15" }, Ct);
        deposit.EnsureSuccessStatusCode();
        VaultTransactionA = (await deposit.Content.ReadFromJsonAsync<JsonElement>(Ct))
            .GetProperty("transaction").GetProperty("id").GetInt32();

        using var b = Api.Client(TokenB);
        TransactionB = await IdOf(b.PostAsJsonAsync("/api/transactions",
            new { description = "Salário B", amount = 200.00m, date = "2020-01-11" }, Ct));
    }

    public ValueTask DisposeAsync() => Api.DisposeAsync();

    private static async Task<int> IdOf(Task<HttpResponseMessage> request)
    {
        using var response = await request;
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
    }
}

// B tentando ler, alterar ou apagar o que é de A, endpoint por endpoint, contra o MySQL.
public class OwnershipTests(OwnershipFixture fixture) : IClassFixture<OwnershipFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient AsA() => fixture.Api.Client(fixture.TokenA);
    private HttpClient AsB() => fixture.Api.Client(fixture.TokenB);

    // {category}, {transaction}, {vault} e {vaultTransaction} viram os Ids de A.
    public static TheoryData<string, string, string?> EndpointsWithIdOfA => new()
    {
        { "GET", "/api/categories/{category}", null },
        { "PUT", "/api/categories/{category}", """{"name":"Invadida"}""" },
        { "DELETE", "/api/categories/{category}", null },
        { "GET", "/api/transactions/{transaction}", null },
        { "PUT", "/api/transactions/{transaction}", """{"description":"Invadida","amount":1,"date":"2020-01-10"}""" },
        { "DELETE", "/api/transactions/{transaction}", null },
        { "GET", "/api/transactions/{vaultTransaction}", null },
        { "PUT", "/api/transactions/{vaultTransaction}", """{"description":"Invadida","amount":1,"date":"2020-01-15"}""" },
        { "DELETE", "/api/transactions/{vaultTransaction}", null },
        { "GET", "/api/vaults/{vault}", null },
        { "PUT", "/api/vaults/{vault}", """{"name":"Invadido","goal":1}""" },
        { "DELETE", "/api/vaults/{vault}", null },
        { "POST", "/api/vaults/{vault}/deposit", """{"amount":10,"date":"2020-01-20"}""" },
        { "POST", "/api/vaults/{vault}/withdraw", """{"amount":10,"date":"2020-01-20"}""" },
    };

    [Theory]
    [MemberData(nameof(EndpointsWithIdOfA))]
    public async Task B_recebe_404_no_que_e_de_A_e_nada_muda(string method, string template, string? body)
    {
        using var b = AsB();
        var path = template
            .Replace("{category}", fixture.CategoryA.ToString())
            .Replace("{transaction}", fixture.TransactionA.ToString())
            .Replace("{vaultTransaction}", fixture.VaultTransactionA.ToString())
            .Replace("{vault}", fixture.VaultA.ToString());
        using var request = new HttpRequestMessage(new HttpMethod(method), path);
        if (body is not null)
            request.Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json");

        using var response = await b.SendAsync(request, Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await AssertDataOfAUnchanged();
    }

    [Fact]
    public async Task A_enxerga_os_proprios_registros()
    {
        await AssertDataOfAUnchanged();
    }

    [Fact]
    public async Task B_nao_usa_categoria_de_A_numa_movimentacao()
    {
        using var b = AsB();
        var body = new { description = "Com categoria de A", amount = -5.00m, date = "2020-01-12", categoryId = fixture.CategoryA };

        using var created = await b.PostAsJsonAsync("/api/transactions", body, Ct);
        using var updated = await b.PutAsJsonAsync($"/api/transactions/{fixture.TransactionB}", body, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, created.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, updated.StatusCode);
        var transactionB = await Json(b.GetAsync($"/api/transactions/{fixture.TransactionB}", Ct));
        Assert.Equal("Salário B", transactionB.GetProperty("description").GetString());
        Assert.Equal(JsonValueKind.Null, transactionB.GetProperty("categoryId").ValueKind);
    }

    [Fact]
    public async Task Filtros_e_listas_de_B_nao_trazem_nada_de_A()
    {
        using var b = AsB();

        var byCategory = await Json(b.GetAsync($"/api/transactions?categoryId={fixture.CategoryA}", Ct));
        var byVault = await Json(b.GetAsync($"/api/transactions?vaultId={fixture.VaultA}", Ct));
        var all = await Json(b.GetAsync("/api/transactions?pageSize=100", Ct));
        var categories = await Json(b.GetAsync("/api/categories", Ct));
        var vaults = await Json(b.GetAsync("/api/vaults", Ct));

        Assert.Equal(0, byCategory.GetProperty("totalCount").GetInt32());
        Assert.Equal(0, byVault.GetProperty("totalCount").GetInt32());
        Assert.DoesNotContain(all.GetProperty("items").EnumerateArray(),
            t => t.GetProperty("id").GetInt32() is var id && (id == fixture.TransactionA || id == fixture.VaultTransactionA));
        Assert.DoesNotContain(categories.EnumerateArray(), c => c.GetProperty("id").GetInt32() == fixture.CategoryA);
        Assert.DoesNotContain(vaults.EnumerateArray(), v => v.GetProperty("id").GetInt32() == fixture.VaultA);
    }

    [Fact]
    public async Task Relatorios_de_B_nao_somam_os_valores_de_A()
    {
        using var b = AsB();
        const string period = "from=2020-01-01&to=2020-01-31";

        var summary = await Json(b.GetAsync($"/api/reports/summary?{period}", Ct));
        var byCategory = await Json(b.GetAsync($"/api/reports/by-category?{period}&type=income", Ct));
        var timeline = await Json(b.GetAsync($"/api/reports/timeline?{period}&groupBy=month", Ct));

        // Só a receita de 200 de B; A tem 1000 de receita e 100 no cofre no mesmo mês.
        Assert.Equal(200m, summary.GetProperty("income").GetDecimal());
        Assert.Equal(0m, summary.GetProperty("vaultDeposits").GetDecimal());
        Assert.Equal(200m, summary.GetProperty("accountBalance").GetDecimal());
        Assert.Equal(0m, summary.GetProperty("vaultsBalance").GetDecimal());
        var only = Assert.Single(byCategory.EnumerateArray());
        Assert.Equal(JsonValueKind.Null, only.GetProperty("categoryId").ValueKind);
        Assert.Equal(200m, Assert.Single(timeline.EnumerateArray()).GetProperty("income").GetDecimal());
    }

    // A, vista por ela mesma, continua como o fixture criou.
    private async Task AssertDataOfAUnchanged()
    {
        using var a = AsA();

        var category = await Json(a.GetAsync($"/api/categories/{fixture.CategoryA}", Ct));
        var transaction = await Json(a.GetAsync($"/api/transactions/{fixture.TransactionA}", Ct));
        var vaultTransaction = await Json(a.GetAsync($"/api/transactions/{fixture.VaultTransactionA}", Ct));
        var vault = await Json(a.GetAsync($"/api/vaults/{fixture.VaultA}", Ct));

        Assert.Equal("Mercado A", category.GetProperty("name").GetString());
        Assert.Equal("Salário A", transaction.GetProperty("description").GetString());
        Assert.Equal(1000m, transaction.GetProperty("amount").GetDecimal());
        Assert.Equal(-100m, vaultTransaction.GetProperty("amount").GetDecimal());
        Assert.Equal("Viagem A", vault.GetProperty("name").GetString());
        Assert.Equal(500m, vault.GetProperty("goal").GetDecimal());
        Assert.Equal(100m, vault.GetProperty("balance").GetDecimal());
    }

    private static async Task<JsonElement> Json(Task<HttpResponseMessage> request)
    {
        using var response = await request;
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
    }
}
