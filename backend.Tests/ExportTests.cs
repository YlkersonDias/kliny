using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace Backend.Tests;

// Exportação dos dados (LGPD), contra o MySQL: o .zip leva tudo o que é da pessoa e nada interno.
// Que outra pessoa não aparece no arquivo fica no OwnershipTests (regra 19).
public class ExportTests(MySqlApi api) : IClassFixture<MySqlApi>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static string Today => DateOnly.FromDateTime(DateTime.UtcNow).ToString("yyyy-MM-dd");

    // O JSON e o CSV de dentro do .zip.
    public static async Task<(JsonElement Json, string Csv)> ReadZipAsync(HttpResponseMessage response)
    {
        var bytes = await response.Content.ReadAsByteArrayAsync(Ct);
        using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
        Assert.Equal(["kliny-dados.json", "kliny-movimentacoes.csv"], zip.Entries.Select(e => e.FullName).Order());

        using var json = await JsonDocument.ParseAsync(zip.GetEntry("kliny-dados.json")!.Open(), cancellationToken: Ct);
        using var csvStream = new MemoryStream();
        await zip.GetEntry("kliny-movimentacoes.csv")!.Open().CopyToAsync(csvStream, Ct);
        var csvBytes = csvStream.ToArray();
        // Com BOM, para o Excel ler os acentos.
        Assert.Equal(Encoding.UTF8.GetPreamble(), csvBytes[..3]);
        return (json.RootElement.Clone(), Encoding.UTF8.GetString(csvBytes[3..]));
    }

    private static async Task<int> IdOf(Task<HttpResponseMessage> request)
    {
        using var response = await request;
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
    }

    // Uma conta com um pouco de tudo, e uma descrição que o Excel executaria como fórmula.
    private async Task<string> AccountWithDataAsync()
    {
        var token = await api.RegisterAsync($"exporta-{Guid.NewGuid():N}@kliny.test");
        using var client = api.Client(token);
        var category = await IdOf(client.PostAsJsonAsync("/api/categories", new { name = "Feira", color = "green", icon = "cart" }, Ct));
        await IdOf(client.PostAsJsonAsync("/api/transactions", new { description = "Salário", amount = 3000.50m, date = "2026-01-05" }, Ct));
        await IdOf(client.PostAsJsonAsync("/api/transactions",
            new { description = "=HYPERLINK(\"http://x\")", amount = -12.30m, date = "2026-01-06", categoryId = category }, Ct));
        await IdOf(client.PostAsJsonAsync("/api/transactions", new { description = "Pão; leite \"integral\"", amount = -8m, date = "2026-01-07" }, Ct));
        var vault = await IdOf(client.PostAsJsonAsync("/api/vaults", new { name = "Viagem", goal = 1000m }, Ct));
        using (var deposit = await client.PostAsJsonAsync($"/api/vaults/{vault}/deposit", new { amount = 200m, date = "2026-01-08" }, Ct))
            deposit.EnsureSuccessStatusCode();
        using (var budget = await client.PutAsJsonAsync($"/api/budgets/{category}", new { amount = 500m }, Ct))
            budget.EnsureSuccessStatusCode();
        await IdOf(client.PostAsJsonAsync("/api/recurrences", new { description = "Aluguel", amount = -900m, startDate = Today }, Ct));
        using (var sync = await client.PostAsJsonAsync("/api/recurrences/sync", new { today = Today }, Ct))
            sync.EnsureSuccessStatusCode();
        using (var installment = await client.PostAsJsonAsync($"/api/installments?today={Today}",
                   new { description = "Geladeira", total = 1000m, count = 2, firstDate = Today, categoryId = category }, Ct))
            installment.EnsureSuccessStatusCode();
        await IdOf(client.PostAsJsonAsync("/api/category-rules", new { pattern = "mercado", categoryId = category }, Ct));
        return token;
    }

    private async Task<HttpResponseMessage> ExportAsync(string token, string? language = null)
    {
        using var client = api.Client(token);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/account/export");
        if (language is not null)
            request.Headers.AcceptLanguage.ParseAdd(language);
        var response = await client.SendAsync(request, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return response;
    }

    [Fact]
    public async Task Exporta_tudo_da_conta_sem_nada_interno()
    {
        var token = await AccountWithDataAsync();
        using var response = await ExportAsync(token);
        Assert.Equal("application/zip", response.Content.Headers.ContentType?.MediaType);
        Assert.True(response.Headers.CacheControl?.NoStore);
        Assert.StartsWith("kliny-dados-", response.Content.Headers.ContentDisposition?.FileNameStar ?? response.Content.Headers.ContentDisposition?.FileName?.Trim('"'));

        var (json, _) = await ReadZipAsync(response);
        Assert.Equal("kliny-export", json.GetProperty("format").GetString());
        var account = json.GetProperty("account");
        Assert.True(account.GetProperty("hasPassword").GetBoolean());
        Assert.False(account.GetProperty("googleLinked").GetBoolean());

        // 9 padrão do cadastro e a Feira.
        var feira = json.GetProperty("categories").EnumerateArray().Single(c => c.GetProperty("name").GetString() == "Feira");
        Assert.Equal("green", feira.GetProperty("color").GetString());

        var vault = json.GetProperty("vaults").EnumerateArray().Single();
        Assert.Equal(200m, vault.GetProperty("balance").GetDecimal());
        Assert.Equal(1000m, vault.GetProperty("goal").GetDecimal());

        var transactions = json.GetProperty("transactions").EnumerateArray().ToList();
        var deposit = transactions.Single(t => t.GetProperty("kind").GetString() == "vault-deposit");
        Assert.Equal("Viagem", deposit.GetProperty("vault").GetString());
        Assert.Equal(-200m, deposit.GetProperty("amount").GetDecimal());
        Assert.Equal("Feira", transactions.Single(t => t.GetProperty("amount").GetDecimal() == -12.30m).GetProperty("category").GetString());
        Assert.Contains(transactions, t => t.GetProperty("recurring").GetBoolean());
        Assert.Equal(2, transactions.Count(t => t.GetProperty("installment").GetBoolean()));

        Assert.Equal(500m, json.GetProperty("budgets")[0].GetProperty("monthlyLimit").GetDecimal());
        Assert.Equal("Aluguel", json.GetProperty("recurrences")[0].GetProperty("description").GetString());
        Assert.Equal(2, json.GetProperty("installments")[0].GetProperty("count").GetInt32());
        Assert.Equal("Feira", json.GetProperty("categoryRules")[0].GetProperty("category").GetString());

        // Nada interno: nem Ids do banco, nem hash, nem chaves.
        var raw = json.GetRawText();
        foreach (var field in new[] { "\"id\"", "userId", "passwordHash", "googleSubject", "tokenVersion", "importKey", "idempotencyKey", "categoryId", "vaultId" })
            Assert.DoesNotContain(field, raw, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Csv_em_portugues_abre_no_excel_e_nao_executa_formula()
    {
        var token = await AccountWithDataAsync();
        using var response = await ExportAsync(token);
        var (_, csv) = await ReadZipAsync(response);
        var lines = csv.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal("Data;Descrição;Valor;Tipo;Categoria;Cofre", lines[0]);
        Assert.Contains("05/01/2026;Salário;3000,50;Receita;;", lines);
        // A fórmula vira texto (apóstrofo), e as aspas do texto são dobradas dentro das aspas do campo.
        Assert.Contains("06/01/2026;\"'=HYPERLINK(\"\"http://x\"\")\";-12,30;Gasto;Feira;", lines);
        Assert.Contains("07/01/2026;\"Pão; leite \"\"integral\"\"\";-8,00;Gasto;;", lines);
        Assert.Contains("08/01/2026;Depósito no cofre Viagem;-200,00;Depósito no cofre;;Viagem", lines);
    }

    [Fact]
    public async Task Csv_em_ingles_usa_virgula_e_ponto()
    {
        var token = await AccountWithDataAsync();
        using var response = await ExportAsync(token, "en-US");
        var (_, csv) = await ReadZipAsync(response);
        var lines = csv.Split("\r\n", StringSplitOptions.RemoveEmptyEntries);

        Assert.Equal("Date,Description,Amount,Type,Category,Vault", lines[0]);
        Assert.Contains("01/05/2026,Salário,3000.50,Income,,", lines);
        Assert.Contains("01/08/2026,Depósito no cofre Viagem,-200.00,Vault deposit,,Viagem", lines);
    }

    [Fact]
    public async Task Sem_login_responde_401()
    {
        using var client = api.Client();
        using var response = await client.GetAsync("/api/account/export", Ct);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
