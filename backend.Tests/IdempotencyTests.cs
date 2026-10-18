using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Backend.Tests;

// Usuários criados uma vez (o cadastro tem limite por IP); cada teste cria os próprios cofres.
public sealed class IdempotencyFixture : IAsyncLifetime
{
    public MySqlApi Api { get; } = new();
    public string TokenA { get; private set; } = "";
    public string TokenB { get; private set; } = "";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Api.InitializeAsync();
        if (!Api.IsAvailable)
            return;

        TokenA = await Api.RegisterAsync("idem-a@kliny.test");
        TokenB = await Api.RegisterAsync("idem-b@kliny.test");
        foreach (var token in new[] { TokenA, TokenB })
        {
            using var client = Api.Client(token);
            using var income = await client.PostAsJsonAsync("/api/transactions",
                new { description = "Saldo inicial", amount = 100_000m, date = "2021-01-01" }, Ct);
            income.EnsureSuccessStatusCode();
        }
    }

    public ValueTask DisposeAsync() => Api.DisposeAsync();
}

public class IdempotencyTests(IdempotencyFixture fixture) : IClassFixture<IdempotencyFixture>
{
    private const string Date = "2021-03-10";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private HttpClient AsA() => fixture.Api.Client(fixture.TokenA);
    private HttpClient AsB() => fixture.Api.Client(fixture.TokenB);

    private static string NewKey() => Guid.NewGuid().ToString();

    private static async Task<int> CreateVaultAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync("/api/vaults", new { name = $"Cofre {Guid.NewGuid():N}" }, Ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
    }

    private static async Task<HttpResponseMessage> Operate(
        HttpClient client, int vault, string operation, decimal amount, string? key, string date = Date)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/vaults/{vault}/{operation}")
        {
            Content = JsonContent.Create(new { amount, date }),
        };
        // Sem chave aqui, o cliente do MySqlApi põe uma nova.
        if (key is not null)
            request.Headers.Add("Idempotency-Key", key);
        return await client.SendAsync(request, Ct);
    }

    private static async Task<int> TransactionIdOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("transaction").GetProperty("id").GetInt32();

    private static async Task<int> StatementCountAsync(HttpClient client, int vault)
    {
        using var response = await client.GetAsync($"/api/transactions?vaultId={vault}", Ct);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("totalCount").GetInt32();
    }

    private static async Task<decimal> BalanceAsync(HttpClient client, int vault)
    {
        using var response = await client.GetAsync($"/api/vaults/{vault}", Ct);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("balance").GetDecimal();
    }

    [Theory]
    [InlineData("deposit")]
    [InlineData("withdraw")]
    public async Task Envio_repetido_devolve_o_mesmo_lancamento(string operation)
    {
        using var client = AsA();
        var vault = await CreateVaultAsync(client);
        if (operation == "withdraw")
            (await Operate(client, vault, "deposit", 300m, null)).EnsureSuccessStatusCode();
        var key = NewKey();

        using var first = await Operate(client, vault, operation, 100m, key);
        using var second = await Operate(client, vault, operation, 100m, key);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.False(first.Headers.Contains("Idempotent-Replayed"));
        Assert.Equal("true", second.Headers.GetValues("Idempotent-Replayed").Single());
        Assert.Equal(await TransactionIdOf(first), await TransactionIdOf(second));
        Assert.Equal(operation == "deposit" ? 100m : 200m, await BalanceAsync(client, vault));
    }

    [Fact]
    public async Task Retirada_repetida_depois_de_esvaziar_o_cofre_nao_e_recusada()
    {
        using var client = AsA();
        var vault = await CreateVaultAsync(client);
        (await Operate(client, vault, "deposit", 50m, null)).EnsureSuccessStatusCode();
        var key = NewKey();

        using var first = await Operate(client, vault, "withdraw", 50m, key);
        using var again = await Operate(client, vault, "withdraw", 50m, key);

        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(await TransactionIdOf(first), await TransactionIdOf(again));
        Assert.Equal(0m, await BalanceAsync(client, vault));
    }

    [Fact]
    public async Task Envios_simultaneos_com_a_mesma_chave_gravam_um_lancamento()
    {
        using var client = AsA();
        var vault = await CreateVaultAsync(client);
        var key = NewKey();

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Operate(client, vault, "deposit", 10m, key)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        var ids = await Task.WhenAll(responses.Select(TransactionIdOf));
        Assert.Single(ids.Distinct());
        Assert.Equal(1, await StatementCountAsync(client, vault));
        foreach (var response in responses)
            response.Dispose();
    }

    [Fact]
    public async Task Mesma_chave_em_cofres_diferentes_ao_mesmo_tempo_grava_uma_vez()
    {
        // Cofres diferentes, travas diferentes: quem perde esbarra no índice único.
        using var client = AsA();
        for (var round = 0; round < 5; round++)
        {
            var first = await CreateVaultAsync(client);
            var second = await CreateVaultAsync(client);
            (await Operate(client, first, "deposit", 20m, null)).EnsureSuccessStatusCode();
            (await Operate(client, second, "deposit", 20m, null)).EnsureSuccessStatusCode();
            var key = NewKey();

            var statuses = await Task.WhenAll(
                StatusOf(Operate(client, first, "withdraw", 20m, key)),
                StatusOf(Operate(client, second, "withdraw", 20m, key)));

            Assert.Equal(1, statuses.Count(s => s == HttpStatusCode.OK));
            Assert.Equal(1, statuses.Count(s => s == HttpStatusCode.UnprocessableEntity));
            Assert.Equal(20m, await BalanceAsync(client, first) + await BalanceAsync(client, second));
        }
    }

    private static async Task<HttpStatusCode> StatusOf(Task<HttpResponseMessage> request)
    {
        using var response = await request;
        return response.StatusCode;
    }

    [Theory]
    [InlineData("deposit", 99, Date, false)]
    [InlineData("deposit", 100, "2021-03-09", false)]
    [InlineData("withdraw", 100, Date, false)]
    [InlineData("deposit", 100, Date, true)]
    public async Task Mesma_chave_numa_operacao_diferente_responde_422(
        string operation, int amount, string date, bool otherVault)
    {
        using var client = AsA();
        var vault = await CreateVaultAsync(client);
        (await Operate(client, vault, "deposit", 500m, null)).EnsureSuccessStatusCode();
        var target = otherVault ? await CreateVaultAsync(client) : vault;
        var key = NewKey();
        (await Operate(client, vault, "deposit", 100m, key)).EnsureSuccessStatusCode();

        using var response = await Operate(client, target, operation, amount, key, date);

        Assert.Equal(HttpStatusCode.UnprocessableEntity, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("Esta chave de idempotência já foi usada numa operação diferente.", body.GetProperty("detail").GetString());
        Assert.Equal(600m, await BalanceAsync(client, vault));
    }

    [Theory]
    [InlineData("tem espaço")]
    [InlineData("barra/no/meio")]
    [InlineData("a;b")]
    public async Task Chave_invalida_responde_400(string key)
    {
        using var client = AsA();
        var vault = await CreateVaultAsync(client);

        using var response = await Operate(client, vault, "deposit", 10m, key);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await StatementCountAsync(client, vault));
    }

    [Fact]
    public async Task Chave_com_mais_de_64_caracteres_responde_400()
    {
        using var client = AsA();
        var vault = await CreateVaultAsync(client);

        using var response = await Operate(client, vault, "deposit", 10m, new string('a', 65));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_chave_de_outro_usuario_nao_devolve_o_lancamento_dele()
    {
        using var a = AsA();
        using var b = AsB();
        var vaultA = await CreateVaultAsync(a);
        var vaultB = await CreateVaultAsync(b);
        var key = NewKey();

        using var fromA = await Operate(a, vaultA, "deposit", 70m, key);
        using var fromB = await Operate(b, vaultB, "deposit", 70m, key);
        using var bOnVaultOfA = await Operate(b, vaultA, "deposit", 70m, key);

        Assert.Equal(HttpStatusCode.OK, fromB.StatusCode);
        Assert.False(fromB.Headers.Contains("Idempotent-Replayed"));
        Assert.NotEqual(await TransactionIdOf(fromA), await TransactionIdOf(fromB));
        Assert.Equal(HttpStatusCode.NotFound, bOnVaultOfA.StatusCode);
        Assert.Equal(70m, await BalanceAsync(a, vaultA));
    }

    [Theory]
    [InlineData("deposit")]
    [InlineData("withdraw")]
    public async Task Sem_chave_responde_400_e_nao_grava(string operation)
    {
        // Cliente sem o handler que põe uma chave em cada envio.
        using var client = AsA();
        using var withoutKeys = fixture.Api.Client(fixture.TokenA, idempotencyKeys: false);
        var vault = await CreateVaultAsync(client);
        (await Operate(client, vault, "deposit", 50m, null)).EnsureSuccessStatusCode();

        using var response = await Operate(withoutKeys, vault, operation, 10m, null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal("Envie o cabeçalho Idempotency-Key: depósitos e retiradas precisam dele para não serem gravados duas vezes.",
            body.GetProperty("detail").GetString());
        Assert.Equal(1, await StatementCountAsync(client, vault));
    }

    [Fact]
    public async Task Chave_vazia_responde_400()
    {
        using var client = AsA();
        var vault = await CreateVaultAsync(client);

        using var response = await Operate(client, vault, "deposit", 10m, "");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await StatementCountAsync(client, vault));
    }
}
