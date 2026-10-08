using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Backend.Tests;

// S.5: "Sair de todos os dispositivos" (POST /api/auth/logout-all) invalida na hora todos os
// tokens do usuário. A versão do token (claim "tv") é conferida com a do banco a cada requisição.
public class TokenRevocationTests(MySqlApi api) : IClassFixture<MySqlApi>
{
    private const string Password = "senha12345";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<string> LoginAsync(string email)
    {
        using var client = api.Client();
        using var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password }, Ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("token").GetString()!;
    }

    private async Task<HttpStatusCode> MeAsync(string token)
    {
        using var client = api.Client(token);
        using var response = await client.GetAsync("/api/auth/me", Ct);
        return response.StatusCode;
    }

    private async Task<int> UserIdAsync(string token)
    {
        using var client = api.Client(token);
        return (await client.GetFromJsonAsync<JsonElement>("/api/auth/me", Ct)).GetProperty("id").GetInt32();
    }

    // Token assinado com a mesma chave e o mesmo emissor da API de teste (MySqlApi), para o teste
    // provar que a recusa vem da versão, e não da assinatura.
    private static string ForgeToken(int userId, int? tokenVersion)
    {
        var claims = new List<Claim> { new(JwtRegisteredClaimNames.Sub, userId.ToString()) };
        if (tokenVersion is { } version)
            claims.Add(new Claim("tv", version.ToString(), ClaimValueTypes.Integer32));
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = "Kliny",
            Audience = "Kliny",
            Expires = DateTime.UtcNow.AddMinutes(10),
            Subject = new ClaimsIdentity(claims),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(new string('k', 64))), SecurityAlgorithms.HmacSha256),
        });
    }

    [Fact]
    public async Task Logout_all_invalida_todos_os_tokens_e_o_login_seguinte_funciona()
    {
        var first = await api.RegisterAsync("revoga@kliny.test");
        var second = await LoginAsync("revoga@kliny.test");
        Assert.Equal(HttpStatusCode.OK, await MeAsync(first));
        Assert.Equal(HttpStatusCode.OK, await MeAsync(second));

        using (var client = api.Client(first))
        using (var response = await client.PostAsync("/api/auth/logout-all", null, Ct))
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        // Os dois "aparelhos" caem, inclusive o que pediu o logout-all.
        Assert.Equal(HttpStatusCode.Unauthorized, await MeAsync(first));
        Assert.Equal(HttpStatusCode.Unauthorized, await MeAsync(second));
        using (var client = api.Client(second))
        using (var response = await client.GetAsync("/api/vaults", Ct))
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);

        var third = await LoginAsync("revoga@kliny.test");
        Assert.Equal(HttpStatusCode.OK, await MeAsync(third));
    }

    [Fact]
    public async Task Logout_all_de_um_usuario_nao_afeta_outro()
    {
        var a = await api.RegisterAsync("revoga-a@kliny.test");
        var b = await api.RegisterAsync("revoga-b@kliny.test");

        using (var client = api.Client(a))
        using (var response = await client.PostAsync("/api/auth/logout-all", null, Ct))
            Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        Assert.Equal(HttpStatusCode.Unauthorized, await MeAsync(a));
        Assert.Equal(HttpStatusCode.OK, await MeAsync(b));
    }

    [Fact]
    public async Task Token_sem_versao_com_versao_errada_ou_de_usuario_inexistente_responde_401()
    {
        // 4 cadastros nesta classe, dentro do limite de 5 por hora por IP.
        var userId = await UserIdAsync(await api.RegisterAsync("revoga-forja@kliny.test"));

        // Controle: um token forjado com a versão atual do banco passa.
        var current = ForgeToken(userId, await CurrentVersionAsync(userId));
        Assert.Equal(HttpStatusCode.OK, await MeAsync(current));

        Assert.Equal(HttpStatusCode.Unauthorized, await MeAsync(ForgeToken(userId, tokenVersion: null)));
        Assert.Equal(HttpStatusCode.Unauthorized, await MeAsync(ForgeToken(userId, tokenVersion: 999)));
        Assert.Equal(HttpStatusCode.Unauthorized, await MeAsync(ForgeToken(999_999, tokenVersion: 0)));
    }

    // Lida direto no banco de teste, com o usuário só de DML da API.
    private async Task<int> CurrentVersionAsync(int userId)
    {
        await using var connection = new MySqlConnector.MySqlConnection(api.AppConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new MySqlConnector.MySqlCommand("SELECT TokenVersion FROM Users WHERE Id = @id", connection);
        command.Parameters.AddWithValue("@id", userId);
        return Convert.ToInt32(await command.ExecuteScalarAsync(Ct));
    }
}
