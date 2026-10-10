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

    // Orçamento (8.2): B não cria orçamento na categoria de A, não vê, não altera nem apaga o de A.
    [Fact]
    public async Task B_nao_mexe_no_orcamento_de_A()
    {
        using (var a = AsA())
        using (var set = await a.PutAsJsonAsync($"/api/budgets/{fixture.CategoryA}", new { amount = 300m }, Ct))
            Assert.Equal(HttpStatusCode.OK, set.StatusCode);

        using (var b = AsB())
        {
            using var steal = await b.PutAsJsonAsync($"/api/budgets/{fixture.CategoryA}", new { amount = 1m }, Ct);
            Assert.Equal(HttpStatusCode.NotFound, steal.StatusCode);
            using var delete = await b.DeleteAsync($"/api/budgets/{fixture.CategoryA}", Ct);
            Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
            var listB = await Json(b.GetAsync("/api/budgets?month=2020-01", Ct));
            Assert.Empty(listB.EnumerateArray());
        }

        using (var a = AsA())
        {
            var listA = await Json(a.GetAsync("/api/budgets?month=2020-01", Ct));
            var only = Assert.Single(listA.EnumerateArray());
            Assert.Equal(300m, only.GetProperty("limit").GetDecimal());
            using var cleanup = await a.DeleteAsync($"/api/budgets/{fixture.CategoryA}", Ct);
            Assert.Equal(HttpStatusCode.NoContent, cleanup.StatusCode);
        }
        await AssertDataOfAUnchanged();
    }

    // Recorrência (8.5a): B não vê, não altera, não pausa nem apaga a de A, não usa a categoria de A
    // numa recorrência, e a sincronização de B não gera nada para A.
    [Fact]
    public async Task B_nao_mexe_na_recorrencia_de_A()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var start = new DateOnly(today.Year, today.Month, 1).AddMonths(-1).ToString("yyyy-MM-dd");
        int ruleA;
        using (var a = AsA())
        using (var created = await a.PostAsJsonAsync("/api/recurrences",
                   new { description = "Aluguel A", amount = -900m, startDate = start, categoryId = fixture.CategoryA }, Ct))
        {
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            ruleA = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
        }

        using (var b = AsB())
        {
            using var update = await b.PutAsJsonAsync($"/api/recurrences/{ruleA}",
                new { description = "Invadida", amount = -1m, paused = true }, Ct);
            Assert.Equal(HttpStatusCode.NotFound, update.StatusCode);
            using var delete = await b.DeleteAsync($"/api/recurrences/{ruleA}", Ct);
            Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
            using var withCategoryOfA = await b.PostAsJsonAsync("/api/recurrences",
                new { description = "Com categoria de A", amount = -1m, startDate = start, categoryId = fixture.CategoryA }, Ct);
            Assert.Equal(HttpStatusCode.BadRequest, withCategoryOfA.StatusCode);
            Assert.Empty((await Json(b.GetAsync("/api/recurrences", Ct))).EnumerateArray());

            using var sync = await b.PostAsJsonAsync("/api/recurrences/sync", new { today = today.ToString("yyyy-MM-dd") }, Ct);
            Assert.Equal(0, (await sync.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("created").GetInt32());
        }

        using (var a = AsA())
        {
            var rule = Assert.Single((await Json(a.GetAsync("/api/recurrences", Ct))).EnumerateArray());
            Assert.Equal("Aluguel A", rule.GetProperty("description").GetString());
            Assert.False(rule.GetProperty("paused").GetBoolean());
            Assert.Equal(start, rule.GetProperty("nextDate").GetString());
            var generated = await Json(a.GetAsync("/api/transactions?search=Aluguel%20A", Ct));
            Assert.Equal(0, generated.GetProperty("totalCount").GetInt32());
            using var cleanup = await a.DeleteAsync($"/api/recurrences/{ruleA}", Ct);
            Assert.Equal(HttpStatusCode.NoContent, cleanup.StatusCode);
        }
        await AssertDataOfAUnchanged();
    }

    // Compra parcelada (8.5b): B não vê nem apaga a de A e não usa a categoria de A numa compra.
    [Fact]
    public async Task B_nao_mexe_na_compra_parcelada_de_A()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd");
        var first = new DateOnly(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1).AddMonths(1).ToString("yyyy-MM-dd");
        int planA;
        using (var a = AsA())
        using (var created = await a.PostAsJsonAsync($"/api/installments?today={today}",
                   new { description = "TV A", total = 900m, count = 3, firstDate = first, categoryId = fixture.CategoryA }, Ct))
        {
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            planA = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
        }

        using (var b = AsB())
        {
            foreach (var scope in new[] { "all", "future" })
            {
                using var delete = await b.DeleteAsync($"/api/installments/{planA}?scope={scope}&today={today}", Ct);
                Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
            }
            using var withCategoryOfA = await b.PostAsJsonAsync($"/api/installments?today={today}",
                new { description = "Com categoria de A", total = 10m, count = 2, firstDate = first, categoryId = fixture.CategoryA }, Ct);
            Assert.Equal(HttpStatusCode.BadRequest, withCategoryOfA.StatusCode);
            Assert.Empty((await Json(b.GetAsync($"/api/installments?today={today}", Ct))).EnumerateArray());
            var search = await Json(b.GetAsync("/api/transactions?search=TV%20A", Ct));
            Assert.Equal(0, search.GetProperty("totalCount").GetInt32());
        }

        using (var a = AsA())
        {
            var plan = Assert.Single((await Json(a.GetAsync($"/api/installments?today={today}", Ct))).EnumerateArray());
            Assert.Equal(3, plan.GetProperty("remaining").GetInt32());
            using var cleanup = await a.DeleteAsync($"/api/installments/{planA}?scope=all&today={today}", Ct);
            Assert.Equal(HttpStatusCode.NoContent, cleanup.StatusCode);
        }
        await AssertDataOfAUnchanged();
    }

    // Regras de categoria (8.4): B não vê, não edita, não apaga nem aplica a regra de A, não usa a
    // categoria de A numa regra, e aplicar a regra de B nunca muda movimentação de A.
    [Fact]
    public async Task B_nao_mexe_nas_regras_de_categoria_de_A()
    {
        int ruleA;
        using (var a = AsA())
        using (var created = await a.PostAsJsonAsync("/api/category-rules", new { pattern = "Salário A", categoryId = fixture.CategoryA }, Ct))
        {
            Assert.Equal(HttpStatusCode.Created, created.StatusCode);
            ruleA = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
        }

        using (var b = AsB())
        {
            using var update = await b.PutAsJsonAsync($"/api/category-rules/{ruleA}", new { pattern = "invadida", categoryId = fixture.CategoryA }, Ct);
            Assert.Equal(HttpStatusCode.NotFound, update.StatusCode);
            using var delete = await b.DeleteAsync($"/api/category-rules/{ruleA}", Ct);
            Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
            using var apply = await b.PostAsync($"/api/category-rules/{ruleA}/apply?includeCategorized=true", null, Ct);
            Assert.Equal(HttpStatusCode.NotFound, apply.StatusCode);
            using var withCategoryOfA = await b.PostAsJsonAsync("/api/category-rules", new { pattern = "qualquer", categoryId = fixture.CategoryA }, Ct);
            Assert.Equal(HttpStatusCode.BadRequest, withCategoryOfA.StatusCode);
            Assert.Empty((await Json(b.GetAsync("/api/category-rules", Ct))).EnumerateArray());

            // Regra de B com um texto que também está na movimentação de A: só as de B mudam.
            int categoryB;
            using (var created = await b.PostAsJsonAsync("/api/categories", new { name = "Renda B" }, Ct))
                categoryB = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
            int ruleB;
            using (var created = await b.PostAsJsonAsync("/api/category-rules", new { pattern = "Salário", categoryId = categoryB }, Ct))
                ruleB = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
            using var applyB = await b.PostAsync($"/api/category-rules/{ruleB}/apply?includeCategorized=true", null, Ct);
            Assert.Equal(1, (await applyB.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("count").GetInt32());
            using (var cleanup = await b.DeleteAsync($"/api/categories/{categoryB}", Ct))
                Assert.Equal(HttpStatusCode.NoContent, cleanup.StatusCode);
        }

        using (var a = AsA())
        {
            var rule = Assert.Single((await Json(a.GetAsync("/api/category-rules", Ct))).EnumerateArray());
            Assert.Equal("Salário A", rule.GetProperty("pattern").GetString());
            var transaction = await Json(a.GetAsync($"/api/transactions/{fixture.TransactionA}", Ct));
            Assert.Equal(fixture.CategoryA, transaction.GetProperty("categoryId").GetInt32());
            using var cleanup = await a.DeleteAsync($"/api/category-rules/{ruleA}", Ct);
            Assert.Equal(HttpStatusCode.NoContent, cleanup.StatusCode);
        }
        await AssertDataOfAUnchanged();
    }

    // Importação (8.3): a chave de importação é por usuário. A mesma linha que A importou é nova
    // para B (nem "já importada" nem "parecida"), e a importação de B não toca em nada de A.
    [Fact]
    public async Task B_nao_enxerga_nem_bloqueia_a_importacao_de_A()
    {
        var line = new { source = "341:9999", externalId = "OWN1", date = "2019-06-01", amount = -33.33m, description = "Importada Dono", occurrence = 1 };
        using (var a = AsA())
        using (var imported = await a.PostAsJsonAsync("/api/imports", new { lines = new[] { line } }, Ct))
            Assert.Equal(1, (await imported.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("created").GetInt32());

        using (var b = AsB())
        {
            using var check = await b.PostAsJsonAsync("/api/imports/check", new { lines = new[] { line } }, Ct);
            Assert.Equal("new", (await check.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("statuses")[0].GetString());
            using var withCategoryOfA = await b.PostAsJsonAsync("/api/imports",
                new { lines = new[] { new { line.source, line.externalId, line.date, line.amount, line.description, line.occurrence, categoryId = fixture.CategoryA } } }, Ct);
            Assert.Equal(HttpStatusCode.BadRequest, withCategoryOfA.StatusCode);
            using var imported = await b.PostAsJsonAsync("/api/imports", new { lines = new[] { line } }, Ct);
            Assert.Equal(1, (await imported.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("created").GetInt32());
            var mine = Assert.Single((await Json(b.GetAsync("/api/transactions?search=Importada%20Dono&from=2019-01-01&to=2019-12-31", Ct)))
                .GetProperty("items").EnumerateArray());
            using var cleanup = await b.DeleteAsync($"/api/transactions/{mine.GetProperty("id").GetInt32()}", Ct);
            Assert.Equal(HttpStatusCode.NoContent, cleanup.StatusCode);
        }

        using (var a = AsA())
        {
            var ofA = Assert.Single((await Json(a.GetAsync("/api/transactions?search=Importada%20Dono&from=2019-01-01&to=2019-12-31", Ct)))
                .GetProperty("items").EnumerateArray());
            Assert.Equal(-33.33m, ofA.GetProperty("amount").GetDecimal());
            using var cleanup = await a.DeleteAsync($"/api/transactions/{ofA.GetProperty("id").GetInt32()}", Ct);
            Assert.Equal(HttpStatusCode.NoContent, cleanup.StatusCode);
        }
        await AssertDataOfAUnchanged();
    }

    // Busca (8.1): B procurando pela descrição de A não acha nada de A, só o que é dele.
    [Fact]
    public async Task Busca_de_B_nunca_encontra_movimentacao_de_A()
    {
        using var b = AsB();

        var exact = await Json(b.GetAsync("/api/transactions?search=Sal%C3%A1rio%20A&from=2020-01-01&to=2020-12-31", Ct));
        var broad = await Json(b.GetAsync("/api/transactions?search=Sal%C3%A1rio&from=2020-01-01&to=2020-12-31&sort=amount-desc", Ct));

        Assert.Equal(0, exact.GetProperty("totalCount").GetInt32());
        var only = Assert.Single(broad.GetProperty("items").EnumerateArray());
        Assert.Equal(fixture.TransactionB, only.GetProperty("id").GetInt32());
    }

    // Vínculo com o Google: B não toma a conta Google de A, e o que B faz no próprio vínculo não
    // mexe no de A (as rotas não recebem Id: o usuário vem sempre do token).
    [Fact]
    public async Task B_nao_vincula_o_Google_de_A_nem_mexe_no_vinculo_dela()
    {
        var googleOfA = FakeGoogleTokenValidator.Credential("g-dono-a", "a-google@outlook.com");
        using (var a = AsA())
        using (var link = await a.PostAsJsonAsync("/api/auth/google/link", new { credential = googleOfA }, Ct))
            Assert.Equal(HttpStatusCode.OK, link.StatusCode);

        using (var b = AsB())
        {
            using var steal = await b.PostAsJsonAsync("/api/auth/google/link", new { credential = googleOfA }, Ct);
            Assert.Equal(HttpStatusCode.Conflict, steal.StatusCode);
            using var unlink = await b.PostAsJsonAsync("/api/auth/google/unlink", new { }, Ct);
            Assert.Equal(HttpStatusCode.OK, unlink.StatusCode);
            Assert.False((await Json(b.GetAsync("/api/auth/me", Ct))).GetProperty("googleLinked").GetBoolean());
        }

        using (var a = AsA())
        {
            var me = await Json(a.GetAsync("/api/auth/me", Ct));
            Assert.True(me.GetProperty("googleLinked").GetBoolean());

            // Entrar com o Google de A continua levando a A.
            using var anonymous = fixture.Api.Client();
            var signIn = await Json(anonymous.PostAsJsonAsync("/api/auth/google", new { credential = googleOfA }, Ct));
            Assert.Equal(me.GetProperty("id").GetInt32(), signIn.GetProperty("user").GetProperty("id").GetInt32());

            using var unlink = await a.PostAsJsonAsync("/api/auth/google/unlink", new { }, Ct);
            Assert.Equal(HttpStatusCode.OK, unlink.StatusCode);
        }

        await AssertDataOfAUnchanged();
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
