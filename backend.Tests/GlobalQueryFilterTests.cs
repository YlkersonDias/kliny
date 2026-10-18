using System.Net.Http.Json;
using System.Text.Json;
using Kliny.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Kliny.Api.Tests;

public sealed class GlobalQueryFilterFixture : IAsyncLifetime
{
    public MySqlApi Api { get; } = new();
    public int UserA { get; private set; }
    public int UserB { get; private set; }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Api.InitializeAsync();
        if (!Api.IsAvailable)
            return;

        UserA = await SeedAsync("filtro-a@kliny.test");
        UserB = await SeedAsync("filtro-b@kliny.test");
    }

    private async Task<int> SeedAsync(string email)
    {
        using var client = Api.Client(await Api.RegisterAsync(email));
        var category = await IdOf(client.PostAsJsonAsync("/api/categories", new { name = "Mercado" }, Ct));
        await IdOf(client.PostAsJsonAsync("/api/transactions",
            new { description = "Salário", amount = 500m, date = "2021-04-01", categoryId = category }, Ct));
        var vault = await IdOf(client.PostAsJsonAsync("/api/vaults", new { name = "Reserva" }, Ct));
        using (var deposit = await client.PostAsJsonAsync($"/api/vaults/{vault}/deposit", new { amount = 50m, date = "2021-04-02" }, Ct))
            deposit.EnsureSuccessStatusCode();
        return (await client.GetFromJsonAsync<JsonElement>("/api/auth/me", Ct)).GetProperty("id").GetInt32();
    }

    private static async Task<int> IdOf(Task<HttpResponseMessage> request)
    {
        using var response = await request;
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
    }

    public ValueTask DisposeAsync() => Api.DisposeAsync();
}

public class GlobalQueryFilterTests(GlobalQueryFilterFixture fixture) : IClassFixture<GlobalQueryFilterFixture>
{
    private static readonly MySqlServerVersion ServerVersion = new(new Version(8, 4, 0));

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private sealed class FixedUser(int? userId) : ICurrentUser
    {
        public int? UserId => userId;
    }

    // Com o usuário só de DML da API.
    private AppDbContext Context(int? userId) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseMySql(fixture.Api.AppConnectionString, ServerVersion).Options,
            new FixedUser(userId));

    [Fact]
    public async Task Consulta_sem_Where_so_traz_o_que_e_do_usuario_logado()
    {
        await using var asA = Context(fixture.UserA);

        // Sem Where(UserId): só o filtro global protege.
        var categories = await asA.Categories.ToListAsync(Ct);
        var vaults = await asA.Vaults.ToListAsync(Ct);
        var transactions = await asA.Transactions.ToListAsync(Ct);

        Assert.NotEmpty(categories);
        Assert.NotEmpty(vaults);
        Assert.Equal(2, transactions.Count);
        Assert.All(categories, c => Assert.Equal(fixture.UserA, c.UserId));
        Assert.All(vaults, v => Assert.Equal(fixture.UserA, v.UserId));
        Assert.All(transactions, t => Assert.Equal(fixture.UserA, t.UserId));
    }

    [Fact]
    public async Task Navegacoes_e_somas_tambem_respeitam_o_filtro()
    {
        await using var asB = Context(fixture.UserB);

        var vaultBalances = await asB.Vaults.Select(v => -v.Transactions.Sum(t => t.Amount)).ToListAsync(Ct);
        var total = await asB.Transactions.SumAsync(t => t.Amount, Ct);

        Assert.Equal([50m], vaultBalances);
        Assert.Equal(450m, total);
    }

    [Fact]
    public async Task Buscar_pelo_Id_de_outro_usuario_nao_acha_nada()
    {
        await using var asA = Context(fixture.UserA);
        var idOfB = await asA.Transactions.IgnoreQueryFilters()
            .Where(t => t.UserId == fixture.UserB).Select(t => t.Id).FirstAsync(Ct);

        Assert.Null(await asA.Transactions.FirstOrDefaultAsync(t => t.Id == idOfB, Ct));
        Assert.Null(await asA.Transactions.FindAsync([idOfB], Ct));
    }

    [Fact]
    public async Task Sem_usuario_logado_nada_aparece()
    {
        await using var anonymous = Context(null);

        Assert.Empty(await anonymous.Categories.ToListAsync(Ct));
        Assert.Empty(await anonymous.Vaults.ToListAsync(Ct));
        Assert.Empty(await anonymous.Transactions.ToListAsync(Ct));
        // Users não é filtrado: o login e a validação do token precisam dele.
        Assert.True(await anonymous.Users.CountAsync(Ct) >= 2);
    }

    [Fact]
    public async Task Ignorar_o_filtro_mostra_os_dois_usuarios()
    {
        await using var asA = Context(fixture.UserA);

        var owners = await asA.Transactions.IgnoreQueryFilters().Select(t => t.UserId).Distinct().ToListAsync(Ct);

        Assert.Contains(fixture.UserA, owners);
        Assert.Contains(fixture.UserB, owners);
    }

    // Com o filtro, o EF poria o FromSql numa subconsulta e o FOR UPDATE sairia do SELECT de fora.
    [Fact]
    public void Trava_do_cofre_continua_com_o_FOR_UPDATE_no_SELECT_de_fora()
    {
        using var asA = Context(fixture.UserA);
        var id = 1;
        var userId = fixture.UserA;

        var locked = asA.Vaults
            .FromSql($"SELECT * FROM Vaults WHERE Id = {id} AND UserId = {userId} FOR UPDATE")
            .IgnoreQueryFilters()
            .ToQueryString();
        var wrapped = asA.Vaults
            .FromSql($"SELECT * FROM Vaults WHERE Id = {id} AND UserId = {userId} FOR UPDATE")
            .ToQueryString();

        Assert.EndsWith("FOR UPDATE", locked.Trim());
        Assert.DoesNotContain("FROM (", locked);
        Assert.Contains("FROM (", wrapped);
    }
}
