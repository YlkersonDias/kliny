using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Security;
using Backend.Services;
using MySqlConnector;

namespace Backend.Tests;

// As contas que já precisam existir são criadas direto no banco.
public sealed class RegistrationFixture : IAsyncLifetime
{
    public MySqlApi Api { get; } = new();

    public ValueTask InitializeAsync() => Api.InitializeAsync();

    public ValueTask DisposeAsync() => Api.DisposeAsync();
}

public class RegistrationTests(RegistrationFixture fixture) : IClassFixture<RegistrationFixture>
{
    private const string Password = "senha-nova-123";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private MySqlApi Api => fixture.Api;

    private static string NewEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@kliny.test";

    private async Task<HttpStatusCode> RequestAsync(string email, string name = "Ana")
    {
        using var client = Api.Client();
        using var response = await client.PostAsJsonAsync("/api/auth/register", new { name, email }, Ct);
        return response.StatusCode;
    }

    private async Task<string> RequestTokenAsync(string email)
    {
        var seen = Api.Emails.CountFor(email);
        Assert.Equal(HttpStatusCode.Accepted, await RequestAsync(email));
        var message = await Api.Emails.WaitForAsync(email, seen, Ct);
        return MySqlApi.RegistrationLink().Match(message.Text).Groups[1].Value;
    }

    private async Task<(HttpStatusCode Status, JsonElement Body)> CompleteAsync(string token, string password = Password)
    {
        using var client = Api.Client();
        using var response = await client.PostAsJsonAsync("/api/auth/register/complete", new { token, password }, Ct);
        var body = response.Content.Headers.ContentLength is 0
            ? default
            : await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return (response.StatusCode, body);
    }

    private async Task<HttpStatusCode> LoginAsync(string email, string password)
    {
        using var client = Api.Client();
        using var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password }, Ct);
        return response.StatusCode;
    }

    private async Task<long> CountAsync(string sql, string email, string? value = null)
    {
        await using var connection = new MySqlConnection(Api.AppConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.AddWithValue("@email", email);
        command.Parameters.AddWithValue("@value", value ?? "");
        return Convert.ToInt64(await command.ExecuteScalarAsync(Ct));
    }

    private Task<long> UsersWithAsync(string email) => CountAsync("SELECT COUNT(*) FROM Users WHERE Email = @email", email);

    private async Task CreateUserAsync(string email, string? password = "senha-antiga-1")
    {
        await using var connection = new MySqlConnection(Api.AppConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new MySqlCommand(
            "INSERT INTO Users (Name, Email, PasswordHash, TokenVersion, CreatedAt) VALUES ('Bia', @email, @hash, 0, UTC_TIMESTAMP(6))", connection);
        command.Parameters.AddWithValue("@email", email);
        command.Parameters.AddWithValue("@hash", password is null ? DBNull.Value : BCrypt.Net.BCrypt.HashPassword(password, 4));
        await command.ExecuteNonQueryAsync(Ct);
    }

    [Fact]
    public async Task Pedido_cria_so_o_link_e_a_conta_nasce_com_a_senha_escolhida_no_link()
    {
        var email = NewEmail("nova");
        var token = await RequestTokenAsync(email);
        var message = Api.Emails.Sent.Last(m => m.To == email);
        Assert.Equal("Termine o seu cadastro no Kliny", message.Subject);
        Assert.Contains("Olá, Ana.", message.Text);
        Assert.Contains($"https://kliny.test/criar-conta#{token}", message.Text);
        Assert.Contains("24 horas", message.Text);

        Assert.Equal(0, await UsersWithAsync(email));
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginAsync(email, Password));

        var (status, body) = await CompleteAsync(token);
        Assert.Equal(HttpStatusCode.Created, status);
        Assert.Equal(email, body.GetProperty("user").GetProperty("email").GetString());
        Assert.Equal("Ana", body.GetProperty("user").GetProperty("name").GetString());
        Assert.False(string.IsNullOrEmpty(body.GetProperty("token").GetString()));

        using (var client = Api.Client(body.GetProperty("token").GetString()))
        using (var me = await client.GetAsync("/api/auth/me", Ct))
            Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.Equal(HttpStatusCode.OK, await LoginAsync(email, Password));
        Assert.Equal(1, await UsersWithAsync(email));
    }

    [Fact]
    public async Task E_mail_com_conta_responde_igual_e_so_recebe_um_aviso()
    {
        var email = NewEmail("existente");
        await CreateUserAsync(email);

        Assert.Equal(HttpStatusCode.Accepted, await RequestAsync($"  {email.ToUpperInvariant()} ", name: "Intruso"));
        var message = await Api.Emails.WaitForAsync(email, 0, Ct);
        Assert.Equal("Você já tem uma conta no Kliny", message.Subject);
        Assert.Contains("Olá, Bia.", message.Text);
        Assert.Contains("https://kliny.test/entrar", message.Text);
        Assert.Contains("https://kliny.test/esqueci-senha", message.Text);
        Assert.DoesNotContain("criar-conta", message.Text);

        Assert.Equal(0, await CountAsync("SELECT COUNT(*) FROM PendingRegistrations WHERE Email = @email", email));
        Assert.Equal(HttpStatusCode.OK, await LoginAsync(email, "senha-antiga-1"));
    }

    [Fact]
    public async Task O_banco_guarda_so_o_hash_do_token()
    {
        var email = NewEmail("hash");
        var token = await RequestTokenAsync(email);
        Assert.Equal(1, await CountAsync(
            "SELECT COUNT(*) FROM PendingRegistrations WHERE Email = @email AND TokenHash = @value", email, OneTimeToken.Hash(token)));
        Assert.Equal(0, await CountAsync(
            "SELECT COUNT(*) FROM PendingRegistrations WHERE Email = @email AND INSTR(TokenHash, @value) > 0", email, token[..10]));
    }

    [Fact]
    public async Task O_link_vale_uma_vez()
    {
        var email = NewEmail("uma-vez");
        var token = await RequestTokenAsync(email);
        Assert.Equal(HttpStatusCode.Created, (await CompleteAsync(token)).Status);

        var (status, body) = await CompleteAsync(token, "outra-senha-99");
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal("O link é inválido ou já expirou. Faça o cadastro de novo para receber outro.", body.GetProperty("detail").GetString());
        Assert.Equal(HttpStatusCode.OK, await LoginAsync(email, Password));
    }

    [Fact]
    public async Task Link_vencido_nao_cria_a_conta()
    {
        var email = NewEmail("vencido");
        var token = await RequestTokenAsync(email);
        await using (var connection = new MySqlConnection(Api.AppConnectionString))
        {
            await connection.OpenAsync(Ct);
            await using var command = new MySqlCommand(
                "UPDATE PendingRegistrations SET ExpiresAt = UTC_TIMESTAMP(6) - INTERVAL 1 SECOND WHERE Email = @email", connection);
            command.Parameters.AddWithValue("@email", email);
            await command.ExecuteNonQueryAsync(Ct);
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await CompleteAsync(token)).Status);
        Assert.Equal(0, await UsersWithAsync(email));
    }

    [Fact]
    public async Task Pedir_de_novo_encerra_o_link_anterior()
    {
        var email = NewEmail("de-novo");
        var first = await RequestTokenAsync(email);
        var second = await RequestTokenAsync(email);
        Assert.NotEqual(first, second);

        Assert.Equal(HttpStatusCode.BadRequest, (await CompleteAsync(first)).Status);
        Assert.Equal(HttpStatusCode.Created, (await CompleteAsync(second)).Status);
    }

    [Fact]
    public async Task No_maximo_tres_e_mails_por_hora_para_o_mesmo_endereco()
    {
        var email = NewEmail("limite");
        await CreateUserAsync(email);
        for (var i = 0; i < RegistrationEmailThrottle.MaxPerHour; i++)
        {
            Assert.Equal(HttpStatusCode.Accepted, await RequestAsync(email));
            await Api.Emails.WaitForAsync(email, i, Ct);
        }

        Assert.Equal(HttpStatusCode.Accepted, await RequestAsync(email));
        await Task.Delay(300, Ct);
        Assert.Equal(RegistrationEmailThrottle.MaxPerHour, Api.Emails.CountFor(email));
    }

    [Fact]
    public async Task E_mail_que_virou_conta_enquanto_o_link_esperava_nao_duplica()
    {
        var email = NewEmail("google-antes");
        var token = await RequestTokenAsync(email);
        // Por exemplo, a pessoa entrou com o Google antes de abrir o e-mail.
        await CreateUserAsync(email, password: null);

        var (status, body) = await CompleteAsync(token);
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal("Já existe uma conta com este e-mail. Entre ou use \"Esqueci minha senha\".", body.GetProperty("detail").GetString());
        Assert.Equal(1, await UsersWithAsync(email));
        Assert.Equal(HttpStatusCode.Unauthorized, await LoginAsync(email, Password));
        Assert.Equal(0, await CountAsync("SELECT COUNT(*) FROM PendingRegistrations WHERE Email = @email", email));
    }

    [Theory]
    [InlineData("curta")]
    [InlineData("")]
    public async Task Senha_fora_das_regras_nao_gasta_o_link(string password)
    {
        var email = NewEmail("regras");
        var token = await RequestTokenAsync(email);
        Assert.Equal(HttpStatusCode.BadRequest, (await CompleteAsync(token, password)).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await CompleteAsync(token, new string('é', 37))).Status);
        Assert.Equal(HttpStatusCode.Created, (await CompleteAsync(token)).Status);
    }

    [Theory]
    [InlineData("nao-existe")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public async Task Token_inexistente_responde_400(string token) =>
        Assert.Equal(HttpStatusCode.BadRequest, (await CompleteAsync(token)).Status);

    [Fact]
    public async Task Cinco_envios_simultaneos_do_mesmo_link_criam_uma_conta()
    {
        var email = NewEmail("simultaneo");
        var token = await RequestTokenAsync(email);

        var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(i => CompleteAsync(token, $"senha-paralela-{i}")));

        Assert.Single(results, r => r.Status == HttpStatusCode.Created);
        Assert.All(results.Where(r => r.Status != HttpStatusCode.Created), r => Assert.Equal(HttpStatusCode.BadRequest, r.Status));
        Assert.Equal(1, await UsersWithAsync(email));
    }

    [Fact]
    public async Task E_mail_no_idioma_do_pedido()
    {
        var email = NewEmail("ingles");
        using var client = Api.Client();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/register")
        {
            Content = JsonContent.Create(new { name = "Ann", email }),
        };
        request.Headers.AcceptLanguage.ParseAdd("en-US");
        using (var response = await client.SendAsync(request, Ct))
            Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);

        var message = await Api.Emails.WaitForAsync(email, 0, Ct);
        Assert.Equal("Finish signing up for Kliny", message.Subject);
        Assert.Contains("24 hours", message.Text);
    }
}
