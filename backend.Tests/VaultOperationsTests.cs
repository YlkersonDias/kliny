using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Backend.Tests;

// Depósito, retirada e exclusão de cofre usam SELECT ... FOR UPDATE, que só um MySQL de verdade
// executa. Cada teste cadastra o próprio usuário: o saldo da conta é cumulativo e não pode vazar
// de um teste para outro.
public class VaultOperationsTests(MySqlApi api) : IClassFixture<MySqlApi>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<HttpClient> NewUserAsync(string email, decimal income)
    {
        var client = api.Client(await api.RegisterAsync(email));
        using var created = await client.PostAsJsonAsync("/api/transactions",
            new { description = "Saldo inicial", amount = income, date = "2021-03-01" }, Ct);
        created.EnsureSuccessStatusCode();
        return client;
    }

    private static async Task<int> CreateVaultAsync(HttpClient client, string name)
    {
        using var response = await client.PostAsJsonAsync("/api/vaults", new { name }, Ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
    }

    private static Task<HttpResponseMessage> Operate(HttpClient client, int vault, string operation, decimal amount) =>
        client.PostAsJsonAsync($"/api/vaults/{vault}/{operation}", new { amount, date = "2021-03-10" }, Ct);

    private static async Task<decimal> BalanceAsync(HttpClient client, int vault)
    {
        using var response = await client.GetAsync($"/api/vaults/{vault}", Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("balance").GetDecimal();
    }

    private static async Task<HttpStatusCode> StatusOf(Task<HttpResponseMessage> request)
    {
        using var response = await request;
        return response.StatusCode;
    }

    [Fact]
    public async Task Deposito_retirada_e_exclusao_seguem_as_regras()
    {
        using var client = await NewUserAsync("cofre@kliny.test", 200m);
        var vault = await CreateVaultAsync(client, "Reserva");

        Assert.Equal(HttpStatusCode.BadRequest, await StatusOf(Operate(client, vault, "deposit", 300m)));
        Assert.Equal(HttpStatusCode.OK, await StatusOf(Operate(client, vault, "deposit", 50m)));
        Assert.Equal(HttpStatusCode.BadRequest, await StatusOf(Operate(client, vault, "withdraw", 80m)));
        Assert.Equal(50m, await BalanceAsync(client, vault));

        // Com saldo não apaga; sem saldo apaga, junto com o histórico.
        Assert.Equal(HttpStatusCode.Conflict, await StatusOf(client.DeleteAsync($"/api/vaults/{vault}", Ct)));
        Assert.Equal(HttpStatusCode.OK, await StatusOf(Operate(client, vault, "withdraw", 50m)));
        Assert.Equal(HttpStatusCode.NoContent, await StatusOf(client.DeleteAsync($"/api/vaults/{vault}", Ct)));
        Assert.Equal(HttpStatusCode.NotFound, await StatusOf(client.GetAsync($"/api/vaults/{vault}", Ct)));

        using var statement = await client.GetAsync($"/api/transactions?vaultId={vault}", Ct);
        var body = await statement.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(0, body.GetProperty("totalCount").GetInt32());
    }

    [Fact]
    public async Task Retiradas_e_depositos_simultaneos_respeitam_os_saldos()
    {
        using var client = await NewUserAsync("concorrencia@kliny.test", 200m);
        var vault = await CreateVaultAsync(client, "Disputado");
        Assert.Equal(HttpStatusCode.OK, await StatusOf(Operate(client, vault, "deposit", 100m)));

        // Cinco retiradas de 100 ao mesmo tempo, com 100 no cofre: a trava do cofre deixa passar uma.
        var withdrawals = await Task.WhenAll(Enumerable.Range(0, 5)
            .Select(_ => StatusOf(Operate(client, vault, "withdraw", 100m))));
        Assert.Equal(1, withdrawals.Count(s => s == HttpStatusCode.OK));
        Assert.Equal(4, withdrawals.Count(s => s == HttpStatusCode.BadRequest));
        Assert.Equal(0m, await BalanceAsync(client, vault));

        // Cinco depósitos de 100 ao mesmo tempo, com 200 na conta: a trava do usuário deixa passar dois.
        var deposits = await Task.WhenAll(Enumerable.Range(0, 5)
            .Select(_ => StatusOf(Operate(client, vault, "deposit", 100m))));
        Assert.Equal(2, deposits.Count(s => s == HttpStatusCode.OK));
        Assert.Equal(3, deposits.Count(s => s == HttpStatusCode.BadRequest));
        Assert.Equal(200m, await BalanceAsync(client, vault));
    }
}
