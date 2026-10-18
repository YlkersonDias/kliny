using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Kliny.Api.DTOs.Imports;
using Kliny.Api.Services;

namespace Kliny.Api.Tests;

// Cada teste usa uma conta (Source) própria, para as chaves não se cruzarem.
public sealed class ImportFixture : IAsyncLifetime
{
    public MySqlApi Api { get; } = new();
    public string Token { get; private set; } = "";
    public int Food { get; private set; }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Api.InitializeAsync();
        if (!Api.IsAvailable)
            return;

        Token = await Api.RegisterAsync("importacao@kliny.test");
        using var client = Api.Client(Token);
        using var created = await client.PostAsJsonAsync("/api/categories", new { name = "Feira" }, Ct);
        created.EnsureSuccessStatusCode();
        Food = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
    }

    public ValueTask DisposeAsync() => Api.DisposeAsync();
}

public class ImportTests(ImportFixture fixture) : IClassFixture<ImportFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient Client() => fixture.Api.Client(fixture.Token);

    private static object Line(string source, string? externalId, string date, decimal amount, string description,
        int occurrence = 1, int? categoryId = null) =>
        new { source, externalId, date, amount, description, occurrence, categoryId };

    private async Task<string[]> CheckAsync(params object[] lines)
    {
        using var client = Client();
        using var response = await client.PostAsJsonAsync("/api/imports/check", new { lines }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return body.GetProperty("statuses").EnumerateArray().Select(s => s.GetString()!).ToArray();
    }

    private async Task<(int Created, int Skipped)> ImportAsync(params object[] lines)
    {
        using var client = Client();
        using var response = await client.PostAsJsonAsync("/api/imports", new { lines }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return (body.GetProperty("created").GetInt32(), body.GetProperty("skipped").GetInt32());
    }

    private async Task<JsonElement[]> SearchAsync(string search)
    {
        using var client = Client();
        var page = await client.GetFromJsonAsync<JsonElement>(
            $"/api/transactions?search={Uri.EscapeDataString(search)}&pageSize=100&sort=date-asc", Ct);
        return page.GetProperty("items").EnumerateArray().ToArray();
    }

    private async Task<HttpStatusCode> PostStatusAsync(string url, object body)
    {
        using var client = Client();
        using var response = await client.PostAsJsonAsync(url, body, Ct);
        return response.StatusCode;
    }

    [Fact]
    public async Task Importa_e_nao_duplica_ao_importar_de_novo()
    {
        object[] lines =
        [
            Line("341:0001", "F1", "2022-01-05", -42.90m, "Mercado Bom Preço Imp01", categoryId: fixture.Food),
            Line("341:0001", "F2", "2022-01-06", 3000m, "Salário Imp01"),
        ];

        Assert.Equal(["new", "new"], await CheckAsync(lines));
        Assert.Equal((2, 0), await ImportAsync(lines));
        Assert.Equal(["imported", "imported"], await CheckAsync(lines));
        Assert.Equal((0, 2), await ImportAsync(lines));

        var saved = await SearchAsync("Imp01");
        Assert.Equal(2, saved.Length);
        Assert.Equal(-42.90m, saved[0].GetProperty("amount").GetDecimal());
        Assert.Equal("2022-01-05", saved[0].GetProperty("date").GetString());
        Assert.Equal(fixture.Food, saved[0].GetProperty("categoryId").GetInt32());
        Assert.Equal(JsonValueKind.Null, saved[1].GetProperty("categoryId").ValueKind);
    }

    [Fact]
    public async Task Arquivo_com_linhas_novas_grava_so_as_novas()
    {
        var first = Line("341:0002", "A1", "2022-02-01", -10m, "Padaria Imp2");
        await ImportAsync(first);

        Assert.Equal((1, 1), await ImportAsync(first, Line("341:0002", "A2", "2022-02-02", -20m, "Farmácia Imp2")));
        Assert.Equal(2, (await SearchAsync("Imp2")).Length);
    }

    [Fact]
    public async Task Mesmo_FITID_em_contas_diferentes_sao_linhas_diferentes()
    {
        Assert.Equal((2, 0), await ImportAsync(
            Line("260:1111", "123", "2022-03-01", -5m, "Café Imp3"),
            Line("077:2222", "123", "2022-03-01", -5m, "Café Imp3")));
    }

    [Fact]
    public async Task Duas_compras_iguais_no_mesmo_dia_sem_FITID_entram_pela_posicao()
    {
        object[] lines =
        [
            Line("104:3333", null, "2022-04-01", -7.50m, "Ônibus Imp4", occurrence: 1),
            Line("104:3333", null, "2022-04-01", -7.50m, "Ônibus Imp4", occurrence: 2),
        ];
        Assert.Equal((2, 0), await ImportAsync(lines));
        Assert.Equal((0, 2), await ImportAsync(lines));

        Assert.Equal(HttpStatusCode.BadRequest, await PostStatusAsync("/api/imports",
            new { lines = new[] { Line("104:3333", null, "2022-04-02", -1m, "Dup Imp4"), Line("104:3333", null, "2022-04-02", -1m, "Dup Imp4") } }));
        Assert.Empty(await SearchAsync("Dup Imp4"));
    }

    [Fact]
    public async Task Lancamento_com_a_mesma_data_e_valor_aparece_como_parecido()
    {
        using (var client = Client())
        using (var manual = await client.PostAsJsonAsync("/api/transactions",
                   new { description = "Conta de luz", amount = -187.33m, date = "2022-05-10" }, Ct))
            manual.EnsureSuccessStatusCode();

        Assert.Equal(["similar", "new", "new"], await CheckAsync(
            Line("341:0005", "L1", "2022-05-10", -187.33m, "ENEL DEB AUT Imp5"),
            Line("341:0005", "L2", "2022-05-11", -187.33m, "Outro dia Imp5"),
            Line("341:0005", "L3", "2022-05-10", 187.33m, "Sinal trocado Imp5")));
    }

    [Fact]
    public async Task Operacao_de_cofre_nao_conta_como_parecida()
    {
        using (var client = Client())
        {
            using var income = await client.PostAsJsonAsync("/api/transactions", new { description = "Renda Imp6", amount = 500m, date = "2022-06-01" }, Ct);
            income.EnsureSuccessStatusCode();
            using var vault = await client.PostAsJsonAsync("/api/vaults", new { name = "Reserva Imp6" }, Ct);
            var vaultId = (await vault.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
            using var deposit = await client.PostAsJsonAsync($"/api/vaults/{vaultId}/deposit", new { amount = 77m, date = "2022-06-02" }, Ct);
            deposit.EnsureSuccessStatusCode();
        }

        Assert.Equal(["new"], await CheckAsync(Line("341:0006", "C1", "2022-06-02", -77m, "Aplicação Imp6")));
    }

    [Theory]
    [InlineData("description", "")]
    [InlineData("description", "   ")]
    [InlineData("amount", 0)]
    [InlineData("amount", 1.234)]
    [InlineData("date", "1999-12-31")]
    [InlineData("date", "2999-01-01")]
    [InlineData("source", "")]
    [InlineData("externalId", " ")]
    [InlineData("occurrence", 0)]
    [InlineData("occurrence", 1001)]
    public async Task Linha_invalida_responde_400_sem_gravar(string field, object value)
    {
        var line = new Dictionary<string, object?>
        {
            ["source"] = "341:0007", ["externalId"] = "X1", ["date"] = "2022-07-01",
            ["amount"] = -1m, ["description"] = "Inválida Imp7", ["occurrence"] = 1,
        };
        line[field] = value;

        Assert.Equal(HttpStatusCode.BadRequest, await PostStatusAsync("/api/imports", new { lines = new[] { line } }));
        Assert.Equal(HttpStatusCode.BadRequest, await PostStatusAsync("/api/imports/check", new { lines = new[] { line } }));
        Assert.Empty(await SearchAsync("Imp7"));
    }

    [Fact]
    public async Task Lista_vazia_ou_grande_demais_responde_400()
    {
        Assert.Equal(HttpStatusCode.BadRequest, await PostStatusAsync("/api/imports", new { lines = Array.Empty<object>() }));
        Assert.Equal(HttpStatusCode.BadRequest, await PostStatusAsync("/api/imports", new { }));

        var many = Enumerable.Range(1, ImportRequest.MaxLines + 1)
            .Select(i => Line("341:0008", $"M{i}", "2022-08-01", -1m, "Muitas Imp8")).ToArray();
        Assert.Equal(HttpStatusCode.BadRequest, await PostStatusAsync("/api/imports", new { lines = many }));
        Assert.Empty(await SearchAsync("Imp8"));

        Assert.Equal((ImportRequest.MaxLines, 0), await ImportAsync(many[..ImportRequest.MaxLines]));
    }

    [Fact]
    public async Task Categoria_inexistente_nao_grava_nenhuma_linha()
    {
        Assert.Equal(HttpStatusCode.BadRequest, await PostStatusAsync("/api/imports", new
        {
            lines = new[]
            {
                Line("341:0009", "K1", "2022-09-01", -1m, "Boa Imp9", categoryId: fixture.Food),
                Line("341:0009", "K2", "2022-09-01", -2m, "Ruim Imp9", categoryId: int.MaxValue),
            },
        }));
        Assert.Empty(await SearchAsync("Imp9"));
    }

    [Fact]
    public async Task Importacoes_simultaneas_do_mesmo_arquivo_gravam_uma_vez()
    {
        var lines = Enumerable.Range(1, 30)
            .Select(i => Line("341:0010", $"S{i}", "2022-10-01", -i, $"Simultânea {i} Imp10")).ToArray();

        var results = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => ImportAsync(lines)));

        Assert.Equal(30, results.Sum(r => r.Created));
        Assert.All(results, r => Assert.Equal(30, r.Created + r.Skipped));
        Assert.Equal(30, (await SearchAsync("Imp10")).Length);
    }

    [Fact]
    public void Chave_depende_das_partes_certas()
    {
        var line = new ImportLine { Source = "341:1", ExternalId = "F", Date = new DateOnly(2022, 1, 1), Amount = -10m, Description = "A", Occurrence = 1 };
        var key = ImportService.Key(line);
        Assert.Matches("^[0-9a-f]{64}$", key);

        // Com FITID, a descrição não entra: o banco pode reescrever o texto.
        Assert.Equal(key, ImportService.Key(new ImportLine { Source = "341:1", ExternalId = "F", Date = line.Date, Amount = -10.00m, Description = "Outra", Occurrence = 1 }));
        Assert.NotEqual(key, ImportService.Key(new ImportLine { Source = "341:2", ExternalId = "F", Date = line.Date, Amount = -10m, Description = "A", Occurrence = 1 }));
        Assert.NotEqual(key, ImportService.Key(new ImportLine { Source = "341:1", ExternalId = "F", Date = line.Date, Amount = -10m, Description = "A", Occurrence = 2 }));

        var noId = new ImportLine { Source = "341:1", Date = line.Date, Amount = -10m, Description = "A", Occurrence = 1 };
        Assert.NotEqual(ImportService.Key(noId), ImportService.Key(new ImportLine { Source = "341:1", Date = line.Date, Amount = -10m, Description = "B", Occurrence = 1 }));
    }

    [Fact]
    public async Task Sem_login_responde_401()
    {
        using var client = fixture.Api.Client();
        using var response = await client.PostAsJsonAsync("/api/imports", new { lines = new[] { Line("1:1", "1", "2022-01-01", -1m, "x") } }, Ct);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
