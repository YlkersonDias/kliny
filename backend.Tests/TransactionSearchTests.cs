using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Backend.Tests;

// Dados criados uma vez por classe (o cadastro tem limite por IP).
public sealed class TransactionSearchFixture : IAsyncLifetime
{
    public MySqlApi Api { get; } = new();
    public string Token { get; private set; } = "";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Api.InitializeAsync();
        if (!Api.IsAvailable)
            return;

        Token = await Api.RegisterAsync("busca@kliny.test");
        using var client = Api.Client(Token);
        foreach (var (description, amount, date) in new[]
        {
            ("Mercado Alimentação", -50.00m, "2021-05-01"),
            ("Aluguel", -1200.00m, "2021-05-02"),
            ("Padaria", -12.50m, "2021-05-03"),
            ("ALIMENTACAO restaurante", -80.00m, "2021-05-04"),
            ("Salário", 3000.00m, "2021-05-05"),
        })
        {
            using var response = await client.PostAsJsonAsync("/api/transactions", new { description, amount, date }, Ct);
            response.EnsureSuccessStatusCode();
        }
    }

    public ValueTask DisposeAsync() => Api.DisposeAsync();
}

public class TransactionSearchTests(TransactionSearchFixture fixture) : IClassFixture<TransactionSearchFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<(string[] Descriptions, int Total)> ListAsync(string query)
    {
        using var client = fixture.Api.Client(fixture.Token);
        var body = await client.GetFromJsonAsync<JsonElement>($"/api/transactions?{query}", Ct);
        var descriptions = body.GetProperty("items").EnumerateArray()
            .Select(item => item.GetProperty("description").GetString()!).ToArray();
        return (descriptions, body.GetProperty("totalCount").GetInt32());
    }

    private async Task<HttpResponseMessage> RawAsync(string query)
    {
        using var client = fixture.Api.Client(fixture.Token);
        return await client.GetAsync($"/api/transactions?{query}", Ct);
    }

    [Fact]
    public async Task Busca_ignora_maiusculas_e_acentos()
    {
        var (descriptions, total) = await ListAsync("search=alimentacao");

        Assert.Equal(2, total);
        Assert.Equal(["ALIMENTACAO restaurante", "Mercado Alimentação"], descriptions);
    }

    [Fact]
    public async Task Busca_combina_com_filtros_e_paginacao()
    {
        var (first, total) = await ListAsync("search=a&type=expense&pageSize=2&page=1");
        var (second, _) = await ListAsync("search=a&type=expense&pageSize=2&page=2");

        Assert.Equal(4, total);
        Assert.Equal(["ALIMENTACAO restaurante", "Padaria"], first);
        Assert.Equal(["Aluguel", "Mercado Alimentação"], second);
    }

    [Theory]
    [InlineData("search=")]
    [InlineData("search=%20%20")]
    public async Task Busca_vazia_nao_filtra(string query)
    {
        var (_, total) = await ListAsync(query);

        Assert.Equal(5, total);
    }

    [Fact]
    public async Task Busca_com_curinga_do_LIKE_e_texto_comum()
    {
        var (_, total) = await ListAsync("search=%25");

        Assert.Equal(0, total);
    }

    [Theory]
    [InlineData("", new[] { "Salário", "ALIMENTACAO restaurante", "Padaria", "Aluguel", "Mercado Alimentação" })]
    [InlineData("sort=date-desc", new[] { "Salário", "ALIMENTACAO restaurante", "Padaria", "Aluguel", "Mercado Alimentação" })]
    [InlineData("sort=date-asc", new[] { "Mercado Alimentação", "Aluguel", "Padaria", "ALIMENTACAO restaurante", "Salário" })]
    [InlineData("sort=amount-desc", new[] { "Salário", "Aluguel", "ALIMENTACAO restaurante", "Mercado Alimentação", "Padaria" })]
    [InlineData("sort=amount-asc", new[] { "Padaria", "Mercado Alimentação", "ALIMENTACAO restaurante", "Aluguel", "Salário" })]
    public async Task Ordenacoes(string query, string[] expected)
    {
        var (descriptions, _) = await ListAsync(query);

        Assert.Equal(expected, descriptions);
    }

    [Theory]
    [InlineData("sort=Amount")]
    [InlineData("sort=Description")]
    [InlineData("sort=date-desc;DROP%20TABLE%20Users")]
    public async Task Ordem_fora_da_lista_responde_400(string query)
    {
        using var response = await RawAsync(query);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("errors");
        Assert.Equal("Ordem inválida.", errors.GetProperty("Sort")[0].GetString());
    }

    [Fact]
    public async Task Busca_longa_demais_responde_400()
    {
        using var ok = await RawAsync($"search={new string('a', 100)}");
        using var tooLong = await RawAsync($"search={new string('a', 101)}");

        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
        var errors = (await tooLong.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("errors");
        Assert.Equal("A busca deve ter no máximo 100 caracteres.", errors.GetProperty("Search")[0].GetString());
    }
}
