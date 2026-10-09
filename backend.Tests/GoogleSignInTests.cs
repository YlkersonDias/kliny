using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MySqlConnector;
using static Backend.Tests.FakeGoogleTokenValidator;

namespace Backend.Tests;

// Entrar com o Google (POST /api/auth/google), contra o MySQL, com o validador do Google falso.
// O Google só decide pelo e-mail (vincular ou criar conta) quando é a autoridade sobre ele, e toda
// recusa responde igual, sem revelar se o e-mail tem conta. 2 cadastros nesta classe.
public class GoogleSignInTests(MySqlApi api) : IClassFixture<MySqlApi>
{
    private const string SignInFailed =
        "Não foi possível entrar com esta conta do Google. Use uma conta Gmail ou do Google Workspace, ou entre com e-mail e senha.";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<HttpResponseMessage> GoogleAsync(string credential)
    {
        using var client = api.Client();
        return await client.PostAsJsonAsync("/api/auth/google", new { credential }, Ct);
    }

    private static async Task<JsonElement> UserOf(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("user");
    }

    private static async Task<string?> DetailOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("detail").GetString();

    private async Task<JsonElement> MeAsync(string token)
    {
        using var client = api.Client(token);
        return await client.GetFromJsonAsync<JsonElement>("/api/auth/me", Ct);
    }

    private async Task<HttpResponseMessage> LoginAsync(string email, string password)
    {
        using var client = api.Client();
        return await client.PostAsJsonAsync("/api/auth/login", new { email, password }, Ct);
    }

    // Lido direto no banco: a API não tem como dizer se um e-mail tem conta (regra 4).
    private async Task<long> UsersWithEmailAsync(string email)
    {
        await using var connection = new MySqlConnection(api.AppConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new MySqlCommand("SELECT COUNT(*) FROM Users WHERE Email = @email", connection);
        command.Parameters.AddWithValue("@email", email);
        return (long)(await command.ExecuteScalarAsync(Ct))!;
    }

    [Fact]
    public async Task Cria_conta_nova_com_Gmail_e_entra_de_novo_na_mesma()
    {
        int id;
        using (var first = await GoogleAsync(Credential("g-nova", " Nova.Pessoa@Gmail.com ")))
        {
            var user = await UserOf(first);
            id = user.GetProperty("id").GetInt32();
            Assert.Equal("nova.pessoa@gmail.com", user.GetProperty("email").GetString());
            Assert.Equal("Pessoa do Google", user.GetProperty("name").GetString());
            Assert.False(user.GetProperty("hasPassword").GetBoolean());
            Assert.True(user.GetProperty("googleLinked").GetBoolean());
        }

        using (var again = await GoogleAsync(Credential("g-nova", "nova.pessoa@gmail.com")))
            Assert.Equal(id, (await UserOf(again)).GetProperty("id").GetInt32());

        // A conta não tem senha: o login com senha nunca entra nela.
        using var login = await LoginAsync("nova.pessoa@gmail.com", "qualquer-senha");
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        Assert.Equal(1, await UsersWithEmailAsync("nova.pessoa@gmail.com"));
    }

    [Fact]
    public async Task Conta_do_Workspace_com_dominio_cria_conta()
    {
        using var response = await GoogleAsync(Credential("g-workspace", "ana@empresa.com.br", hostedDomain: "empresa.com.br"));

        Assert.Equal("ana@empresa.com.br", (await UserOf(response)).GetProperty("email").GetString());
    }

    [Theory]
    [InlineData("g-nao-verificado", "nao-verificado@gmail.com", false, null)]
    [InlineData("g-outlook", "pessoa@outlook.com", true, null)]
    [InlineData("g-workspace-nao-verificado", "bia@empresa.com.br", false, "empresa.com.br")]
    public async Task Sem_autoridade_do_Google_nao_cria_conta(string subject, string email, bool verified, string? hostedDomain)
    {
        using var response = await GoogleAsync(Credential(subject, email, verified, hostedDomain));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(SignInFailed, await DetailOf(response));
        Assert.Equal(0, await UsersWithEmailAsync(email));
    }

    [Fact]
    public async Task Vincula_a_conta_com_senha_quando_o_Google_e_a_autoridade()
    {
        var token = await api.RegisterAsync("vincular@gmail.com");
        var id = (await MeAsync(token)).GetProperty("id").GetInt32();

        using (var google = await GoogleAsync(Credential("g-vincular", "vincular@gmail.com")))
        {
            var user = await UserOf(google);
            Assert.Equal(id, user.GetProperty("id").GetInt32());
            Assert.True(user.GetProperty("hasPassword").GetBoolean());
            Assert.True(user.GetProperty("googleLinked").GetBoolean());
        }

        // A senha continua valendo, e não surgiu outra conta.
        using var login = await LoginAsync("vincular@gmail.com", "senha12345");
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(1, await UsersWithEmailAsync("vincular@gmail.com"));
    }

    [Fact]
    public async Task Sem_autoridade_nao_vincula_e_responde_igual_a_email_sem_conta()
    {
        var token = await api.RegisterAsync("outra@kliny.test");

        using var existing = await GoogleAsync(Credential("g-intruso", "outra@kliny.test"));
        using var missing = await GoogleAsync(Credential("g-ninguem", "ninguem@kliny.test"));

        // Mesma resposta com e sem conta: quem tenta não descobre se o e-mail está cadastrado.
        Assert.Equal(HttpStatusCode.Unauthorized, existing.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, missing.StatusCode);
        Assert.Equal(SignInFailed, await DetailOf(existing));
        Assert.Equal(SignInFailed, await DetailOf(missing));
        Assert.False((await MeAsync(token)).GetProperty("googleLinked").GetBoolean());
    }

    [Fact]
    public async Task Conta_ja_vinculada_a_outro_Google_nao_troca_sozinha()
    {
        int id;
        using (var first = await GoogleAsync(Credential("g-seis-a", "seis@gmail.com")))
            id = (await UserOf(first)).GetProperty("id").GetInt32();

        using (var other = await GoogleAsync(Credential("g-seis-b", "seis@gmail.com")))
        {
            Assert.Equal(HttpStatusCode.Unauthorized, other.StatusCode);
            Assert.Equal(SignInFailed, await DetailOf(other));
        }

        using var original = await GoogleAsync(Credential("g-seis-a", "seis@gmail.com"));
        Assert.Equal(id, (await UserOf(original)).GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task Comprovante_invalido_responde_401_e_vazio_400()
    {
        using var invalid = await GoogleAsync("isto-nao-e-um-comprovante");
        Assert.Equal(HttpStatusCode.Unauthorized, invalid.StatusCode);
        Assert.Equal(SignInFailed, await DetailOf(invalid));

        using var empty = await GoogleAsync("");
        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);

        using var tooLong = await GoogleAsync(new string('a', 8193));
        Assert.Equal(HttpStatusCode.BadRequest, tooLong.StatusCode);
    }
}
