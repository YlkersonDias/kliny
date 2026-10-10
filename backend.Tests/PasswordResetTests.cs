using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Backend.Services;
using MySqlConnector;

namespace Backend.Tests;

// Recuperação de senha, contra o MySQL. Os usuários são criados direto no banco (o cadastro tem
// limite de 5 por hora por IP), um por teste, para os testes não dependerem da ordem.
public sealed class PasswordResetFixture : IAsyncLifetime
{
    public MySqlApi Api { get; } = new();

    public ValueTask InitializeAsync() => Api.InitializeAsync();

    public ValueTask DisposeAsync() => Api.DisposeAsync();
}

public partial class PasswordResetTests(PasswordResetFixture fixture) : IClassFixture<PasswordResetFixture>
{
    private const string OldPassword = "senha-antiga-1";
    private const string NewPassword = "senha-nova-123";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private MySqlApi Api => fixture.Api;

    [GeneratedRegex("^https://kliny\\.test/redefinir-senha#([A-Za-z0-9_-]{43})$", RegexOptions.Multiline)]
    private static partial Regex LinkPattern();

    // Insere o usuário direto no banco, com a senha (ou sem, como uma conta só do Google).
    private async Task<string> CreateUserAsync(string name, string? password = OldPassword)
    {
        var email = $"{name}-{Guid.NewGuid():N}@kliny.test";
        await using var connection = new MySqlConnection(Api.AppConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new MySqlCommand(
            "INSERT INTO Users (Name, Email, PasswordHash, TokenVersion, CreatedAt) VALUES ('Ana', @email, @hash, 0, UTC_TIMESTAMP(6))", connection);
        command.Parameters.AddWithValue("@email", email);
        command.Parameters.AddWithValue("@hash", password is null ? DBNull.Value : BCrypt.Net.BCrypt.HashPassword(password, 4));
        await command.ExecuteNonQueryAsync(Ct);
        return email;
    }

    private async Task<HttpStatusCode> ForgotAsync(string email, string? language = null)
    {
        using var client = Api.Client();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/forgot-password") { Content = JsonContent.Create(new { email }) };
        if (language is not null)
            request.Headers.AcceptLanguage.ParseAdd(language);
        using var response = await client.SendAsync(request, Ct);
        return response.StatusCode;
    }

    // Pede o link e devolve o token que chegou no e-mail.
    private async Task<string> RequestTokenAsync(string email)
    {
        var seen = Api.Emails.CountFor(email);
        Assert.Equal(HttpStatusCode.NoContent, await ForgotAsync(email));
        var message = await Api.Emails.WaitForAsync(email, seen, Ct);
        return LinkPattern().Match(message.Text).Groups[1].Value;
    }

    private async Task<(HttpStatusCode Status, string? Detail)> ResetAsync(string token, string password = NewPassword)
    {
        using var client = Api.Client();
        using var response = await client.PostAsJsonAsync("/api/auth/reset-password", new { token, password }, Ct);
        string? detail = null;
        if (response.Content.Headers.ContentType?.MediaType?.Contains("json") == true)
        {
            var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
            if (body.TryGetProperty("detail", out var value))
                detail = value.GetString();
        }
        return (response.StatusCode, detail);
    }

    private async Task<(HttpStatusCode Status, string? Token)> LoginAsync(string email, string password)
    {
        using var client = Api.Client();
        using var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password }, Ct);
        if (response.StatusCode != HttpStatusCode.OK)
            return (response.StatusCode, null);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return (response.StatusCode, body.GetProperty("token").GetString());
    }

    private async Task<HttpStatusCode> MeAsync(string token)
    {
        using var client = Api.Client(token);
        using var response = await client.GetAsync("/api/auth/me", Ct);
        return response.StatusCode;
    }

    [Fact]
    public async Task Responde_igual_com_e_sem_conta_e_so_manda_email_para_quem_tem()
    {
        var email = await CreateUserAsync("pedido");
        var token = await RequestTokenAsync(email);
        Assert.Matches("^[A-Za-z0-9_-]{43}$", token);
        var message = Api.Emails.Sent.Last(m => m.To == email);
        Assert.Equal("Crie uma senha nova no Kliny", message.Subject);
        Assert.Contains("Olá, Ana.", message.Text);
        Assert.Contains("30 minutos", message.Text);

        // Sem conta: a mesma resposta, e nenhum e-mail.
        var nobody = $"ninguem-{Guid.NewGuid():N}@kliny.test";
        Assert.Equal(HttpStatusCode.NoContent, await ForgotAsync(nobody));
        await Task.Delay(300, Ct);
        Assert.Equal(0, Api.Emails.CountFor(nobody));
    }

    [Fact]
    public async Task Maiusculas_e_espacos_no_email_acham_a_conta()
    {
        var email = await CreateUserAsync("maiusculas");
        Assert.Equal(HttpStatusCode.NoContent, await ForgotAsync($"  {email.ToUpperInvariant()}  "));
        await Api.Emails.WaitForAsync(email, 0, Ct);
    }

    [Fact]
    public async Task E_mail_no_idioma_do_pedido()
    {
        var email = await CreateUserAsync("ingles");
        Assert.Equal(HttpStatusCode.NoContent, await ForgotAsync(email, "en-US"));
        var message = await Api.Emails.WaitForAsync(email, 0, Ct);
        Assert.Equal("Create a new Kliny password", message.Subject);
        Assert.Contains("30 minutes", message.Text);
    }

    [Fact]
    public async Task Troca_a_senha_derruba_as_sessoes_e_o_link_vale_uma_vez()
    {
        var email = await CreateUserAsync("troca");
        var (_, oldSession) = await LoginAsync(email, OldPassword);
        Assert.Equal(HttpStatusCode.OK, await MeAsync(oldSession!));

        var token = await RequestTokenAsync(email);
        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(token)).Status);

        Assert.Equal(HttpStatusCode.Unauthorized, await MeAsync(oldSession!));
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(email, OldPassword)).Status);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, NewPassword)).Status);

        var (status, detail) = await ResetAsync(token, "outra-senha-99");
        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Equal("O link é inválido ou já expirou. Peça um novo em \"Esqueci minha senha\".", detail);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, NewPassword)).Status);
    }

    [Fact]
    public async Task O_banco_guarda_so_o_hash_do_token()
    {
        var email = await CreateUserAsync("hash");
        var token = await RequestTokenAsync(email);

        await using var connection = new MySqlConnection(Api.AppConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new MySqlCommand(
            "SELECT t.TokenHash FROM PasswordResetTokens t JOIN Users u ON u.Id = t.UserId WHERE u.Email = @email", connection);
        command.Parameters.AddWithValue("@email", email);
        var stored = (string)(await command.ExecuteScalarAsync(Ct))!;
        Assert.Equal(PasswordResetService.Hash(token), stored);
        Assert.DoesNotContain(token, stored);
    }

    [Fact]
    public async Task Link_vencido_nao_vale()
    {
        var email = await CreateUserAsync("vencido");
        var token = await RequestTokenAsync(email);
        await using (var connection = new MySqlConnection(Api.AppConnectionString))
        {
            await connection.OpenAsync(Ct);
            await using var command = new MySqlCommand(
                "UPDATE PasswordResetTokens SET ExpiresAt = UTC_TIMESTAMP(6) - INTERVAL 1 SECOND WHERE TokenHash = @hash", connection);
            command.Parameters.AddWithValue("@hash", PasswordResetService.Hash(token));
            Assert.Equal(1, await command.ExecuteNonQueryAsync(Ct));
        }

        Assert.Equal(HttpStatusCode.BadRequest, (await ResetAsync(token)).Status);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, OldPassword)).Status);
    }

    [Fact]
    public async Task Pedir_outro_link_encerra_o_anterior()
    {
        var email = await CreateUserAsync("outro");
        var first = await RequestTokenAsync(email);
        var second = await RequestTokenAsync(email);
        Assert.NotEqual(first, second);

        Assert.Equal(HttpStatusCode.BadRequest, (await ResetAsync(first)).Status);
        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(second)).Status);
    }

    [Fact]
    public async Task No_maximo_tres_links_por_hora_para_a_mesma_conta()
    {
        var email = await CreateUserAsync("limite");
        for (var i = 0; i < PasswordResetService.MaxPerHour; i++)
            await RequestTokenAsync(email);

        // O quarto pedido responde igual, mas não manda nada.
        Assert.Equal(HttpStatusCode.NoContent, await ForgotAsync(email));
        await Task.Delay(300, Ct);
        Assert.Equal(PasswordResetService.MaxPerHour, Api.Emails.CountFor(email));
    }

    [Fact]
    public async Task Conta_so_do_Google_cria_uma_senha_pelo_link()
    {
        var email = await CreateUserAsync("google", password: null);
        var token = await RequestTokenAsync(email);
        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(token)).Status);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, NewPassword)).Status);
    }

    [Theory]
    [InlineData("curta")]
    [InlineData("")]
    public async Task Senha_nova_fora_das_regras_nao_gasta_o_link(string password)
    {
        var email = await CreateUserAsync("regras");
        var token = await RequestTokenAsync(email);
        Assert.Equal(HttpStatusCode.BadRequest, (await ResetAsync(token, password)).Status);
        // 37 "é" passam de 72 bytes (S.6).
        Assert.Equal(HttpStatusCode.BadRequest, (await ResetAsync(token, new string('é', 37))).Status);
        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(token)).Status);
    }

    [Theory]
    [InlineData("")]
    [InlineData("nao-existe")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")]
    public async Task Token_inexistente_ou_malformado_responde_400(string token)
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await ResetAsync(token)).Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await ResetAsync(new string('a', 101))).Status);
    }

    [Fact]
    public async Task Troca_destrava_o_login_bloqueado()
    {
        var email = await CreateUserAsync("bloqueio");
        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(email, "senha-errada-1")).Status);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await LoginAsync(email, OldPassword)).Status);

        var token = await RequestTokenAsync(email);
        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(token)).Status);
        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(email, NewPassword)).Status);
    }

    [Fact]
    public async Task Duas_trocas_simultaneas_com_o_mesmo_link_so_uma_passa()
    {
        var email = await CreateUserAsync("simultanea");
        var token = await RequestTokenAsync(email);

        var results = await Task.WhenAll(Enumerable.Range(0, 5).Select(i => ResetAsync(token, $"senha-paralela-{i}")));

        Assert.Single(results, r => r.Status == HttpStatusCode.NoContent);
        Assert.All(results.Where(r => r.Status != HttpStatusCode.NoContent), r => Assert.Equal(HttpStatusCode.BadRequest, r.Status));
    }

    // Regra 19: o link de uma pessoa só mexe na conta dela. Fica aqui, e não no OwnershipTests,
    // porque trocar a senha de A ou B derrubaria os tokens que aqueles testes usam.
    [Fact]
    public async Task O_link_de_uma_pessoa_nao_mexe_na_conta_de_outra()
    {
        var ana = await CreateUserAsync("dona");
        var bia = await CreateUserAsync("outra");
        var (_, biaSession) = await LoginAsync(bia, OldPassword);

        var token = await RequestTokenAsync(ana);
        Assert.Equal(HttpStatusCode.NoContent, (await ResetAsync(token)).Status);

        Assert.Equal(HttpStatusCode.OK, (await LoginAsync(bia, OldPassword)).Status);
        Assert.Equal(HttpStatusCode.Unauthorized, (await LoginAsync(bia, NewPassword)).Status);
        Assert.Equal(HttpStatusCode.OK, await MeAsync(biaSession!));
        Assert.Equal(0, Api.Emails.CountFor(bia));
    }

    [Fact]
    public async Task Pedido_com_email_invalido_responde_400()
    {
        using var client = Api.Client();
        using var response = await client.PostAsJsonAsync("/api/auth/forgot-password", new { email = "sem-arroba" }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
