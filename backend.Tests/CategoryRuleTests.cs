using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Kliny.Api.Tests;

public sealed class CategoryRuleFixture : IAsyncLifetime
{
    public MySqlApi Api { get; } = new();
    public string Token { get; private set; } = "";
    public string LimitToken { get; private set; } = "";
    public int Food { get; private set; }
    public int Home { get; private set; }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Api.InitializeAsync();
        if (!Api.IsAvailable)
            return;

        Token = await Api.RegisterAsync("regras@kliny.test");
        LimitToken = await Api.RegisterAsync("regras-limite@kliny.test");
        using var client = Api.Client(Token);
        Food = await IdOf(client.PostAsJsonAsync("/api/categories", new { name = "Feira" }, Ct));
        Home = await IdOf(client.PostAsJsonAsync("/api/categories", new { name = "Casa e contas" }, Ct));
        using var income = await client.PostAsJsonAsync("/api/transactions", new { description = "Salário", amount = 5000m, date = "2021-01-01" }, Ct);
        income.EnsureSuccessStatusCode();
    }

    public ValueTask DisposeAsync() => Api.DisposeAsync();

    public static async Task<int> IdOf(Task<HttpResponseMessage> request)
    {
        using var response = await request;
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
    }
}

public class CategoryRuleTests(CategoryRuleFixture fixture) : IClassFixture<CategoryRuleFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Client(string? token = null) => fixture.Api.Client(token ?? fixture.Token);

    private async Task<int> CreateRuleAsync(string pattern, int categoryId)
    {
        using var client = Client();
        return await CategoryRuleFixture.IdOf(client.PostAsJsonAsync("/api/category-rules", new { pattern, categoryId }, Ct));
    }

    private async Task<int> CreateTransactionAsync(string description, decimal amount = -10m, int? categoryId = null)
    {
        using var client = Client();
        return await CategoryRuleFixture.IdOf(client.PostAsJsonAsync("/api/transactions",
            new { description, amount, date = "2021-02-01", categoryId }, Ct));
    }

    private async Task<int> ApplyAsync(int ruleId, string query)
    {
        using var client = Client();
        using var response = await client.PostAsync($"/api/category-rules/{ruleId}/apply?{query}", null, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("count").GetInt32();
    }

    private async Task<int?> CategoryOfAsync(int transactionId)
    {
        using var client = Client();
        var transaction = await client.GetFromJsonAsync<JsonElement>($"/api/transactions/{transactionId}", Ct);
        return transaction.GetProperty("categoryId").ValueKind == JsonValueKind.Null ? null : transaction.GetProperty("categoryId").GetInt32();
    }

    [Fact]
    public async Task Cria_lista_edita_e_apaga()
    {
        var id = await CreateRuleAsync("  padaria  ", fixture.Food);

        using var client = Client();
        var rule = (await client.GetFromJsonAsync<JsonElement>("/api/category-rules", Ct)).EnumerateArray()
            .Single(r => r.GetProperty("id").GetInt32() == id);
        Assert.Equal("padaria", rule.GetProperty("pattern").GetString());
        Assert.Equal("Feira", rule.GetProperty("categoryName").GetString());

        using (var update = await client.PutAsJsonAsync($"/api/category-rules/{id}", new { pattern = "padoca", categoryId = fixture.Home }, Ct))
        {
            Assert.Equal(HttpStatusCode.OK, update.StatusCode);
            var updated = await update.Content.ReadFromJsonAsync<JsonElement>(Ct);
            Assert.Equal("padoca", updated.GetProperty("pattern").GetString());
            Assert.Equal("Casa e contas", updated.GetProperty("categoryName").GetString());
        }

        using (var delete = await client.DeleteAsync($"/api/category-rules/{id}", Ct))
            Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        using (var again = await client.DeleteAsync($"/api/category-rules/{id}", Ct))
            Assert.Equal(HttpStatusCode.NotFound, again.StatusCode);
    }

    [Fact]
    public async Task Texto_repetido_sem_diferenciar_maiusculas_nem_acentos_responde_409()
    {
        await CreateRuleAsync("Açougue", fixture.Food);

        using var client = Client();
        using var response = await client.PostAsJsonAsync("/api/category-rules", new { pattern = "acougue", categoryId = fixture.Home }, Ct);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("Já existe uma regra com esse texto.", (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("detail").GetString());
    }

    public static TheoryData<string, string> InvalidRequests => new()
    {
        { """{"pattern":"","categoryId":1}""", "Pattern" },
        { """{"pattern":"   ","categoryId":1}""", "Pattern" },
        { $$"""{"pattern":"{{new string('x', 101)}}","categoryId":1}""", "Pattern" },
        { """{"pattern":"texto"}""", "CategoryId" },
    };

    [Theory]
    [MemberData(nameof(InvalidRequests))]
    public async Task Pedido_invalido_responde_400(string body, string field)
    {
        using var client = Client();
        using var response = await client.PostAsync("/api/category-rules", new StringContent(body, System.Text.Encoding.UTF8, "application/json"), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("errors").TryGetProperty(field, out _), body);
    }

    [Fact]
    public async Task Categoria_inexistente_responde_400()
    {
        using var client = Client();
        using var response = await client.PostAsJsonAsync("/api/category-rules", new { pattern = "qualquer", categoryId = 999999 }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Aplicar_conta_antes_e_por_padrao_so_muda_as_sem_categoria()
    {
        var plain = await CreateTransactionAsync("Hortifruti do bairro");
        var upper = await CreateTransactionAsync("HORTIFRÚTI online");
        var categorized = await CreateTransactionAsync("Hortifruti na conta da casa", categoryId: fixture.Home);
        var other = await CreateTransactionAsync("Farmácia");
        var rule = await CreateRuleAsync("hortifruti", fixture.Food);

        Assert.Equal(2, await ApplyAsync(rule, "preview=true"));
        Assert.Null(await CategoryOfAsync(plain));

        Assert.Equal(2, await ApplyAsync(rule, ""));
        Assert.Equal(fixture.Food, await CategoryOfAsync(plain));
        Assert.Equal(fixture.Food, await CategoryOfAsync(upper));
        Assert.Equal(fixture.Home, await CategoryOfAsync(categorized));
        Assert.Null(await CategoryOfAsync(other));

        Assert.Equal(1, await ApplyAsync(rule, "preview=true&includeCategorized=true"));
        Assert.Equal(1, await ApplyAsync(rule, "includeCategorized=true"));
        Assert.Equal(fixture.Food, await CategoryOfAsync(categorized));
        Assert.Equal(0, await ApplyAsync(rule, "includeCategorized=true"));
    }

    [Fact]
    public async Task Aplicar_nunca_mexe_em_operacao_de_cofre()
    {
        int vault;
        using (var client = Client())
        {
            vault = await CategoryRuleFixture.IdOf(client.PostAsJsonAsync("/api/vaults", new { name = "Quitanda" }, Ct));
            using var deposit = await client.PostAsJsonAsync($"/api/vaults/{vault}/deposit", new { amount = 10m, date = "2021-02-02" }, Ct);
            deposit.EnsureSuccessStatusCode();
        }
        var rule = await CreateRuleAsync("quitanda", fixture.Food);

        Assert.Equal(0, await ApplyAsync(rule, "preview=true&includeCategorized=true"));
        Assert.Equal(0, await ApplyAsync(rule, "includeCategorized=true"));
    }

    [Fact]
    public async Task Curinga_do_LIKE_e_procurado_como_texto()
    {
        await CreateTransactionAsync("Desconto 10% loja");
        await CreateTransactionAsync("Loja sem desconto");
        var rule = await CreateRuleAsync("10%", fixture.Food);

        Assert.Equal(1, await ApplyAsync(rule, "preview=true"));
    }

    [Fact]
    public async Task Apagar_a_categoria_apaga_a_regra()
    {
        int category;
        using (var client = Client())
            category = await CategoryRuleFixture.IdOf(client.PostAsJsonAsync("/api/categories", new { name = "Pets" }, Ct));
        var rule = await CreateRuleAsync("petshop", category);

        using (var client = Client())
        using (var delete = await client.DeleteAsync($"/api/categories/{category}", Ct))
            Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        using var check = Client();
        var rules = await check.GetFromJsonAsync<JsonElement>("/api/category-rules", Ct);
        Assert.DoesNotContain(rules.EnumerateArray(), r => r.GetProperty("id").GetInt32() == rule);
    }

    [Fact]
    public async Task Limite_por_usuario()
    {
        int category;
        using (var client = Client(fixture.LimitToken))
            category = await CategoryRuleFixture.IdOf(client.PostAsJsonAsync("/api/categories", new { name = "Geral" }, Ct));
        using var limitClient = Client(fixture.LimitToken);
        for (var i = 0; i < Kliny.Api.Services.CategoryRuleService.MaxPerUser; i++)
        {
            using var created = await limitClient.PostAsJsonAsync("/api/category-rules", new { pattern = $"regra {i}", categoryId = category }, Ct);
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        }

        using var response = await limitClient.PostAsJsonAsync("/api/category-rules", new { pattern = "mais uma", categoryId = category }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("Você chegou ao limite de 100 regras.", (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Sem_login_responde_401()
    {
        using var client = fixture.Api.Client();
        using var response = await client.GetAsync("/api/category-rules", Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
