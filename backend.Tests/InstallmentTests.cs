using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Kliny.Api.Services;

namespace Kliny.Api.Tests;

public class InstallmentSplitTests
{
    [Theory]
    [InlineData("100", 3, new[] { "33.34", "33.33", "33.33" })]
    [InlineData("1500", 10, new[] { "150", "150", "150", "150", "150", "150", "150", "150", "150", "150" })]
    [InlineData("0.05", 3, new[] { "0.03", "0.01", "0.01" })]
    [InlineData("0.02", 2, new[] { "0.01", "0.01" })]
    [InlineData("10.01", 2, new[] { "5.01", "5" })]
    public void Divide_em_centavos_com_a_sobra_na_primeira(string total, int count, string[] expected)
    {
        var parts = InstallmentService.Split(decimal.Parse(total, System.Globalization.CultureInfo.InvariantCulture), count);

        Assert.Equal(expected.Select(e => decimal.Parse(e, System.Globalization.CultureInfo.InvariantCulture)), parts);
    }

    [Fact]
    public void A_soma_e_sempre_o_total()
    {
        var random = new Random(85);
        for (var i = 0; i < 2000; i++)
        {
            var total = random.Next(2, 10_000_000) / 100m;
            var count = random.Next(2, 121);
            if (total * 100 < count)
                continue;
            var parts = InstallmentService.Split(total, count);
            Assert.Equal(total, parts.Sum());
            Assert.All(parts, p => Assert.True(p >= 0.01m));
        }
    }

    [Fact]
    public void Datas_mensais_no_dia_da_primeira()
    {
        var dates = InstallmentService.Dates(new DateOnly(2026, 1, 31), 4);

        Assert.Equal([new(2026, 1, 31), new(2026, 2, 28), new(2026, 3, 31), new(2026, 4, 30)], dates);
    }
}

// Datas a partir de hoje (UTC), que a API aceita como "hoje".
public sealed class InstallmentFixture : IAsyncLifetime
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

        Token = await Api.RegisterAsync("parcelado@kliny.test");
        LimitToken = await Api.RegisterAsync("parcelado-limite@kliny.test");
        using var client = Api.Client(Token);
        using var response = await client.PostAsJsonAsync("/api/categories", new { name = "Casa" }, Ct);
        response.EnsureSuccessStatusCode();
        Category = (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
    }

    public ValueTask DisposeAsync() => Api.DisposeAsync();
}

public class InstallmentTests(InstallmentFixture fixture) : IClassFixture<InstallmentFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    private static DateOnly MonthStart(int months) => new DateOnly(Today.Year, Today.Month, 1).AddMonths(months);

    private static string Iso(DateOnly date) => date.ToString("yyyy-MM-dd");

    private static string TodayQuery => $"today={Iso(Today)}";

    private HttpClient Client(string? token = null) => fixture.Api.Client(token ?? fixture.Token);

    private async Task<JsonElement> CreateAsync(object body, string? token = null)
    {
        using var client = Client(token);
        using var response = await client.PostAsJsonAsync($"/api/installments?{TodayQuery}", body, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
    }

    private async Task<JsonElement[]> TransactionsAsync(string description)
    {
        using var client = Client();
        var body = await client.GetFromJsonAsync<JsonElement>(
            $"/api/transactions?search={Uri.EscapeDataString(description)}&sort=date-asc&pageSize=100", Ct);
        return body.GetProperty("items").EnumerateArray().ToArray();
    }

    private async Task<JsonElement[]> ListAsync()
    {
        using var client = Client();
        return (await client.GetFromJsonAsync<JsonElement>($"/api/installments?{TodayQuery}", Ct)).EnumerateArray().ToArray();
    }

    private async Task<HttpResponseMessage> DeleteAsync(int id, string scope)
    {
        using var client = Client();
        return await client.DeleteAsync($"/api/installments/{id}?scope={scope}&{TodayQuery}", Ct);
    }

    [Fact]
    public async Task Cria_todas_as_parcelas_de_uma_vez()
    {
        var first = MonthStart(0).AddDays(4);
        var plan = await CreateAsync(new { description = "Geladeira", total = 100m, count = 3, firstDate = Iso(first), categoryId = fixture.Category });

        Assert.Equal(3, plan.GetProperty("count").GetInt32());
        Assert.Equal(100m, plan.GetProperty("total").GetDecimal());
        Assert.Equal(Iso(first.AddMonths(2)), plan.GetProperty("lastDate").GetString());
        Assert.Equal("Casa", plan.GetProperty("categoryName").GetString());

        var items = await TransactionsAsync("Geladeira (");
        Assert.Equal(["Geladeira (1/3)", "Geladeira (2/3)", "Geladeira (3/3)"], items.Select(t => t.GetProperty("description").GetString()));
        Assert.Equal([-33.34m, -33.33m, -33.33m], items.Select(t => t.GetProperty("amount").GetDecimal()));
        Assert.Equal([Iso(first), Iso(first.AddMonths(1)), Iso(first.AddMonths(2))], items.Select(t => t.GetProperty("date").GetString()));
        var id = plan.GetProperty("id").GetInt32();
        Assert.All(items, t =>
        {
            Assert.Equal(id, t.GetProperty("installmentPlanId").GetInt32());
            Assert.Equal(fixture.Category, t.GetProperty("categoryId").GetInt32());
            Assert.Equal(JsonValueKind.Null, t.GetProperty("recurrenceId").ValueKind);
        });
    }

    [Fact]
    public async Task Faltam_conta_as_parcelas_depois_de_hoje()
    {
        var plan = await CreateAsync(new { description = "Sofá", total = 600m, count = 6, firstDate = Iso(Today.AddMonths(-3)) });

        var listed = (await ListAsync()).Single(p => p.GetProperty("id").GetInt32() == plan.GetProperty("id").GetInt32());
        var expected = InstallmentService.Dates(Today.AddMonths(-3), 6).Count(d => d > Today);
        Assert.Equal(expected, listed.GetProperty("remaining").GetInt32());
        Assert.Equal(expected, plan.GetProperty("remaining").GetInt32());
    }

    [Fact]
    public async Task Apagar_so_as_futuras_mantem_as_outras_sem_o_vinculo()
    {
        var firstDate = Today.AddMonths(-2);
        var plan = await CreateAsync(new { description = "Notebook", total = 5000m, count = 10, firstDate = Iso(firstDate) });
        var kept = InstallmentService.Dates(firstDate, 10).Count(d => d <= Today);

        using (var response = await DeleteAsync(plan.GetProperty("id").GetInt32(), "future"))
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var items = await TransactionsAsync("Notebook (");
        Assert.Equal(kept, items.Length);
        Assert.All(items, t =>
        {
            Assert.Equal(JsonValueKind.Null, t.GetProperty("installmentPlanId").ValueKind);
            Assert.True(DateOnly.Parse(t.GetProperty("date").GetString()!) <= Today);
        });
        Assert.DoesNotContain(await ListAsync(), p => p.GetProperty("id").GetInt32() == plan.GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task Apagar_todas_leva_todas_as_parcelas()
    {
        var plan = await CreateAsync(new { description = "Bicicleta", total = 1200m, count = 12, firstDate = Iso(Today.AddMonths(-1)) });

        using (var response = await DeleteAsync(plan.GetProperty("id").GetInt32(), "all"))
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        using (var again = await DeleteAsync(plan.GetProperty("id").GetInt32(), "all"))
            Assert.Equal(HttpStatusCode.NotFound, again.StatusCode);

        Assert.Empty(await TransactionsAsync("Bicicleta ("));
    }

    [Fact]
    public async Task Parcela_se_edita_e_apaga_como_qualquer_movimentacao()
    {
        var plan = await CreateAsync(new { description = "Celular", total = 300m, count = 3, firstDate = Iso(MonthStart(1)) });
        var second = (await TransactionsAsync("Celular ("))[1];

        using (var client = Client())
        {
            using var update = await client.PutAsJsonAsync($"/api/transactions/{second.GetProperty("id").GetInt32()}",
                new { description = "Celular (2/3)", amount = -110m, date = second.GetProperty("date").GetString() }, Ct);
            Assert.Equal(HttpStatusCode.OK, update.StatusCode);
            var updated = await update.Content.ReadFromJsonAsync<JsonElement>(Ct);
            Assert.Equal(plan.GetProperty("id").GetInt32(), updated.GetProperty("installmentPlanId").GetInt32());
        }

        Assert.Equal([-100m, -110m, -100m], (await TransactionsAsync("Celular (")).Select(t => t.GetProperty("amount").GetDecimal()));
    }

    public static TheoryData<string, string> InvalidCreates => new()
    {
        { """{"description":"","total":10,"count":2,"firstDate":"{today}"}""", "Description" },
        { $$"""{"description":"{{new string('x', 246)}}","total":10,"count":2,"firstDate":"{today}"}""", "Description" },
        { """{"description":"Zero","total":0,"count":2,"firstDate":"{today}"}""", "Total" },
        { """{"description":"Negativo","total":-10,"count":2,"firstDate":"{today}"}""", "Total" },
        { """{"description":"Três casas","total":10.123,"count":2,"firstDate":"{today}"}""", "Total" },
        { """{"description":"Pouco","total":0.02,"count":3,"firstDate":"{today}"}""", "Total" },
        { """{"description":"Uma","total":10,"count":1,"firstDate":"{today}"}""", "Count" },
        { """{"description":"Muitas","total":1000,"count":121,"firstDate":"{today}"}""", "Count" },
        { """{"description":"Sem data","total":10,"count":2}""", "FirstDate" },
        { """{"description":"Longe","total":10,"count":2,"firstDate":"{twoYearsAgo}"}""", "FirstDate" },
    };

    [Theory]
    [MemberData(nameof(InvalidCreates))]
    public async Task Criacao_invalida_responde_400(string body, string field)
    {
        body = body.Replace("{today}", Iso(Today)).Replace("{twoYearsAgo}", Iso(Today.AddYears(-2)));
        using var client = Client();
        using var response = await client.PostAsync($"/api/installments?{TodayQuery}",
            new StringContent(body, System.Text.Encoding.UTF8, "application/json"), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("errors");
        Assert.True(errors.TryGetProperty(field, out _), body);
    }

    [Theory]
    [InlineData("everything")]
    [InlineData("")]
    [InlineData("ALL")]
    public async Task Escopo_fora_da_lista_responde_400(string scope)
    {
        var description = $"Escopo {scope}x";
        var plan = await CreateAsync(new { description, total = 20m, count = 2, firstDate = Iso(MonthStart(1)) });

        using var response = await DeleteAsync(plan.GetProperty("id").GetInt32(), scope);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(2, (await TransactionsAsync($"{description} (")).Length);
    }

    [Theory]
    [InlineData(2)]
    [InlineData(-2)]
    public async Task Hoje_longe_da_data_do_servidor_responde_400(int days)
    {
        using var client = Client();
        using var response = await client.GetAsync($"/api/installments?today={Iso(Today.AddDays(days))}", Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Limite_por_usuario()
    {
        var future = Iso(MonthStart(1));
        for (var i = 0; i < InstallmentService.MaxPerUser; i++)
            await CreateAsync(new { description = $"Compra {i}", total = 2m, count = 2, firstDate = future }, fixture.LimitToken);

        using var client = Client(fixture.LimitToken);
        using var response = await client.PostAsJsonAsync($"/api/installments?{TodayQuery}",
            new { description = "Mais uma", total = 2m, count = 2, firstDate = future }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("Você chegou ao limite de 100 compras parceladas.",
            (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Sem_login_responde_401()
    {
        using var client = fixture.Api.Client();
        using var list = await client.GetAsync($"/api/installments?{TodayQuery}", Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, list.StatusCode);
    }
}
