using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Kliny.Api.Tests;

// As datas partem de hoje (UTC), porque a sincronização só aceita a data de hoje.
public sealed class RecurrenceFixture : IAsyncLifetime
{
    public MySqlApi Api { get; } = new();
    public string Token { get; private set; } = "";
    public string LimitToken { get; private set; } = "";
    public int Category { get; private set; }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Api.InitializeAsync();
        if (!Api.IsAvailable)
            return;

        Token = await Api.RegisterAsync("recorrente@kliny.test");
        LimitToken = await Api.RegisterAsync("recorrente-limite@kliny.test");
        using var client = Api.Client(Token);
        using var response = await client.PostAsJsonAsync("/api/categories", new { name = "Casa e contas" }, Ct);
        response.EnsureSuccessStatusCode();
        Category = (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
    }

    public ValueTask DisposeAsync() => Api.DisposeAsync();
}

public class RecurrenceTests(RecurrenceFixture fixture) : IClassFixture<RecurrenceFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    private static DateOnly MonthStart(int months) => new DateOnly(Today.Year, Today.Month, 1).AddMonths(months);

    private static string Iso(DateOnly date) => date.ToString("yyyy-MM-dd");

    private HttpClient Client(string? token = null) => fixture.Api.Client(token ?? fixture.Token);

    private async Task<JsonElement> CreateAsync(object body, string? token = null)
    {
        using var client = Client(token);
        using var response = await client.PostAsJsonAsync("/api/recurrences", body, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
    }

    private async Task<int> SyncAsync(DateOnly? today = null)
    {
        using var client = Client();
        using var response = await client.PostAsJsonAsync("/api/recurrences/sync", new { today = Iso(today ?? Today) }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("created").GetInt32();
    }

    private async Task<JsonElement[]> TransactionsAsync(string description)
    {
        using var client = Client();
        var body = await client.GetFromJsonAsync<JsonElement>(
            $"/api/transactions?search={Uri.EscapeDataString(description)}&sort=date-asc&pageSize=100", Ct);
        return body.GetProperty("items").EnumerateArray().ToArray();
    }

    private async Task<JsonElement> GetAsync(int id)
    {
        using var client = Client();
        var list = await client.GetFromJsonAsync<JsonElement>("/api/recurrences", Ct);
        return list.EnumerateArray().Single(r => r.GetProperty("id").GetInt32() == id);
    }

    [Fact]
    public async Task Gera_os_meses_que_faltam_ate_o_fim_do_mes_atual_e_so_uma_vez()
    {
        var start = MonthStart(-2);
        var rule = await CreateAsync(new { description = "Aluguel mensal", amount = -1500m, startDate = Iso(start), categoryId = fixture.Category });
        Assert.Equal(1, rule.GetProperty("dayOfMonth").GetInt32());
        Assert.Equal(Iso(start), rule.GetProperty("nextDate").GetString());

        Assert.Equal(3, await SyncAsync());
        Assert.Equal(0, await SyncAsync());

        var items = await TransactionsAsync("Aluguel mensal");
        Assert.Equal([Iso(start), Iso(MonthStart(-1)), Iso(MonthStart(0))], items.Select(t => t.GetProperty("date").GetString()));
        var id = rule.GetProperty("id").GetInt32();
        Assert.All(items, t =>
        {
            Assert.Equal(-1500m, t.GetProperty("amount").GetDecimal());
            Assert.Equal(fixture.Category, t.GetProperty("categoryId").GetInt32());
            Assert.Equal(id, t.GetProperty("recurrenceId").GetInt32());
        });
        Assert.Equal(Iso(MonthStart(1)), (await GetAsync(id)).GetProperty("nextDate").GetString());
    }

    [Fact]
    public async Task Primeira_data_no_mes_que_vem_ainda_nao_gera()
    {
        await CreateAsync(new { description = "Academia futura", amount = -99.90m, startDate = Iso(MonthStart(1)) });

        Assert.Equal(0, await SyncAsync());
        Assert.Empty(await TransactionsAsync("Academia futura"));
    }

    [Fact]
    public async Task Para_na_data_final()
    {
        var rule = await CreateAsync(new
        {
            description = "Curso com fim",
            amount = -200m,
            startDate = Iso(MonthStart(-3)),
            endDate = Iso(MonthStart(-2)),
        });

        Assert.Equal(2, await SyncAsync());
        Assert.Equal(2, (await TransactionsAsync("Curso com fim")).Length);
        Assert.Equal(Iso(MonthStart(-1)), (await GetAsync(rule.GetProperty("id").GetInt32())).GetProperty("nextDate").GetString());
    }

    [Fact]
    public async Task Pausada_nao_gera_e_pula_as_datas_que_passaram()
    {
        var rule = await CreateAsync(new { description = "Streaming pausado", amount = -39.90m, startDate = Iso(MonthStart(-2)) });
        var id = rule.GetProperty("id").GetInt32();
        await UpdateAsync(id, new { description = "Streaming pausado", amount = -39.90m, paused = true });

        Assert.Equal(0, await SyncAsync());
        Assert.Empty(await TransactionsAsync("Streaming pausado"));
        var paused = await GetAsync(id);
        Assert.True(paused.GetProperty("paused").GetBoolean());
        var next = Today.Day == 1 ? Today : MonthStart(1);
        Assert.Equal(Iso(next), paused.GetProperty("nextDate").GetString());

        await UpdateAsync(id, new { description = "Streaming pausado", amount = -39.90m, paused = false });
        Assert.Equal(Today.Day == 1 ? 1 : 0, await SyncAsync());
    }

    [Fact]
    public async Task Ocorrencia_apagada_nao_volta()
    {
        await CreateAsync(new { description = "Internet de casa", amount = -120m, startDate = Iso(MonthStart(-1)) });
        Assert.Equal(2, await SyncAsync());
        var first = (await TransactionsAsync("Internet de casa"))[0].GetProperty("id").GetInt32();

        using (var client = Client())
        using (var delete = await client.DeleteAsync($"/api/transactions/{first}", Ct))
            Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        Assert.Equal(0, await SyncAsync());
        Assert.Single(await TransactionsAsync("Internet de casa"));
    }

    [Fact]
    public async Task Editar_vale_para_as_proximas_e_mantem_as_ja_geradas()
    {
        var rule = await CreateAsync(new { description = "Plano de celular", amount = -50m, startDate = Iso(MonthStart(-1)) });
        var id = rule.GetProperty("id").GetInt32();
        Assert.Equal(2, await SyncAsync());

        var updated = await UpdateAsync(id, new { description = "Plano de celular novo", amount = -65m, categoryId = fixture.Category });

        Assert.Equal("Plano de celular novo", updated.GetProperty("description").GetString());
        Assert.Equal(-65m, updated.GetProperty("amount").GetDecimal());
        Assert.Equal("Casa e contas", updated.GetProperty("categoryName").GetString());
        Assert.Equal(1, updated.GetProperty("dayOfMonth").GetInt32());
        Assert.All(await TransactionsAsync("Plano de celular"), t => Assert.Equal(-50m, t.GetProperty("amount").GetDecimal()));
        Assert.Equal(0, await SyncAsync());
    }

    [Fact]
    public async Task Apagar_a_regra_mantem_as_movimentacoes_sem_o_vinculo()
    {
        var rule = await CreateAsync(new { description = "Salário fixo", amount = 4000m, startDate = Iso(MonthStart(-1)) });
        Assert.Equal(2, await SyncAsync());

        using (var client = Client())
        {
            using var delete = await client.DeleteAsync($"/api/recurrences/{rule.GetProperty("id").GetInt32()}", Ct);
            Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
            using var again = await client.DeleteAsync($"/api/recurrences/{rule.GetProperty("id").GetInt32()}", Ct);
            Assert.Equal(HttpStatusCode.NotFound, again.StatusCode);
        }

        var items = await TransactionsAsync("Salário fixo");
        Assert.Equal(2, items.Length);
        Assert.All(items, t => Assert.Equal(JsonValueKind.Null, t.GetProperty("recurrenceId").ValueKind));
    }

    [Fact]
    public async Task Apagar_a_categoria_deixa_a_regra_sem_categoria()
    {
        int category;
        using (var client = Client())
        using (var created = await client.PostAsJsonAsync("/api/categories", new { name = "Assinaturas" }, Ct))
            category = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
        var rule = await CreateAsync(new { description = "Jornal digital", amount = -20m, startDate = Iso(MonthStart(1)), categoryId = category });

        using (var client = Client())
        using (var delete = await client.DeleteAsync($"/api/categories/{category}", Ct))
            Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        Assert.Equal(JsonValueKind.Null, (await GetAsync(rule.GetProperty("id").GetInt32())).GetProperty("categoryId").ValueKind);
    }

    [Fact]
    public async Task Sincronizacoes_simultaneas_nao_duplicam()
    {
        await CreateAsync(new { description = "Condomínio simultâneo", amount = -700m, startDate = Iso(MonthStart(-11)) });

        var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => SyncAsync()));

        Assert.Equal(12, results.Sum());
        var dates = (await TransactionsAsync("Condomínio simultâneo")).Select(t => t.GetProperty("date").GetString()).ToArray();
        Assert.Equal(12, dates.Length);
        Assert.Equal(12, dates.Distinct().Count());
    }

    [Fact]
    public async Task Lista_em_ordem_de_descricao()
    {
        await CreateAsync(new { description = "Zz ordem", amount = -1m, startDate = Iso(MonthStart(1)) });
        await CreateAsync(new { description = "aa ordem", amount = -1m, startDate = Iso(MonthStart(1)) });

        using var client = Client();
        var list = await client.GetFromJsonAsync<JsonElement>("/api/recurrences", Ct);
        var descriptions = list.EnumerateArray().Select(r => r.GetProperty("description").GetString()!).ToList();

        Assert.True(descriptions.IndexOf("aa ordem") < descriptions.IndexOf("Zz ordem"));
    }

    public static TheoryData<string, string> InvalidCreates => new()
    {
        { """{"description":"","amount":-10,"startDate":"{today}"}""", "Description" },
        { """{"description":"Zero","amount":0,"startDate":"{today}"}""", "Amount" },
        { """{"description":"Três casas","amount":-10.123,"startDate":"{today}"}""", "Amount" },
        { """{"description":"Sem data","amount":-10}""", "StartDate" },
        { """{"description":"Longe demais","amount":-10,"startDate":"{twoYearsAgo}"}""", "StartDate" },
        { """{"description":"Fim antes","amount":-10,"startDate":"{today}","endDate":"{yesterday}"}""", "EndDate" },
    };

    [Theory]
    [MemberData(nameof(InvalidCreates))]
    public async Task Criacao_invalida_responde_400(string body, string field)
    {
        body = body.Replace("{today}", Iso(Today))
            .Replace("{yesterday}", Iso(Today.AddDays(-1)))
            .Replace("{twoYearsAgo}", Iso(Today.AddYears(-2)));
        using var client = Client();
        using var response = await client.PostAsync("/api/recurrences",
            new StringContent(body, System.Text.Encoding.UTF8, "application/json"), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("errors");
        Assert.True(errors.TryGetProperty(field, out _), body);
    }

    [Fact]
    public async Task Editar_com_fim_antes_do_inicio_responde_400()
    {
        var rule = await CreateAsync(new { description = "Fim errado", amount = -10m, startDate = Iso(MonthStart(1)) });
        using var client = Client();
        using var response = await client.PutAsJsonAsync($"/api/recurrences/{rule.GetProperty("id").GetInt32()}",
            new { description = "Fim errado", amount = -10m, endDate = Iso(MonthStart(0)) }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("A data final deve ser igual ou posterior à primeira.",
            (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("detail").GetString());
    }

    [Theory]
    [InlineData(2)]
    [InlineData(-2)]
    public async Task Hoje_longe_da_data_do_servidor_responde_400(int days)
    {
        using var client = Client();
        using var response = await client.PostAsJsonAsync("/api/recurrences/sync", new { today = Iso(Today.AddDays(days)) }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Inexistente_responde_404()
    {
        using var client = Client();
        using var put = await client.PutAsJsonAsync("/api/recurrences/999999", new { description = "X", amount = -1m }, Ct);
        using var delete = await client.DeleteAsync("/api/recurrences/999999", Ct);

        Assert.Equal(HttpStatusCode.NotFound, put.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, delete.StatusCode);
    }

    [Fact]
    public async Task Limite_por_usuario()
    {
        var future = Iso(MonthStart(2));
        for (var i = 0; i < 50; i++)
            await CreateAsync(new { description = $"Regra {i}", amount = -1m, startDate = future }, fixture.LimitToken);

        using var client = Client(fixture.LimitToken);
        using var response = await client.PostAsJsonAsync("/api/recurrences",
            new { description = "Regra 51", amount = -1m, startDate = future }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("Você chegou ao limite de 50 lançamentos recorrentes.",
            (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Sem_login_responde_401()
    {
        using var client = fixture.Api.Client();
        using var list = await client.GetAsync("/api/recurrences", Ct);
        using var sync = await client.PostAsJsonAsync("/api/recurrences/sync", new { today = Iso(Today) }, Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, list.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, sync.StatusCode);
    }

    private async Task<JsonElement> UpdateAsync(int id, object body)
    {
        using var client = Client();
        using var response = await client.PutAsJsonAsync($"/api/recurrences/{id}", body, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
    }
}
