using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Backend.Services.Email;
using static Backend.Tests.FakeGoogleTokenValidator;

namespace Backend.Tests;

// Avisos de segurança por e-mail (senha trocada, conta Google vinculada ou desvinculada), contra o
// MySQL, com o FakeEmailSender. Cada ação manda um aviso só, só para o e-mail da própria conta, e as
// ações recusadas ou que não mudam nada não mandam (regra 19: a ação de uma pessoa não avisa outra).
public partial class SecurityNoticeTests(MySqlApi api) : IClassFixture<MySqlApi>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [GeneratedRegex("/redefinir-senha#([A-Za-z0-9_-]{43})")]
    private static partial Regex ResetLink();

    private static string NewEmail(string name, string domain = "kliny.test") => $"{name}-{Guid.NewGuid():N}@{domain}";

    // Os e-mails saem em segundo plano: espera um pouco antes de conferir que nenhum chegou.
    private async Task AssertNoNewEmailAsync(string email, int seen)
    {
        await Task.Delay(500, Ct);
        Assert.Equal(seen, api.Emails.CountFor(email));
    }

    private static void AssertNotice(EmailMessage message, string subject, params string[] contains)
    {
        Assert.Equal(subject, message.Subject);
        Assert.Contains("Olá, Teste.", message.Text);
        Assert.Contains("suporte@kliny.app.br", message.Text);
        foreach (var text in contains)
            Assert.Contains(text, message.Text);
        // Nenhum link de uso único num aviso.
        Assert.DoesNotContain("#", message.Text);
    }

    private async Task<HttpResponseMessage> PostAsync(string? token, string path, object body, string? language = null)
    {
        using var client = api.Client(token);
        using var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) };
        if (language is not null)
            request.Headers.AcceptLanguage.ParseAdd(language);
        return await client.SendAsync(request, Ct);
    }

    // Troca a senha pelo link do e-mail e devolve o aviso que chegou depois.
    private async Task<EmailMessage> ResetPasswordAsync(string email, string? language = null)
    {
        var seen = api.Emails.CountFor(email);
        using (var forgot = await PostAsync(null, "/api/auth/forgot-password", new { email }))
            Assert.Equal(HttpStatusCode.NoContent, forgot.StatusCode);
        var link = await api.Emails.WaitForAsync(email, seen, Ct);
        // Pedir o link não é a troca: só o e-mail do link chegou.
        await AssertNoNewEmailAsync(email, seen + 1);

        var token = ResetLink().Match(link.Text).Groups[1].Value;
        using (var reset = await PostAsync(null, "/api/auth/reset-password", new { token, password = "senha-nova-123" }, language))
            Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        var notice = await api.Emails.WaitForAsync(email, seen + 1, Ct);
        Assert.DoesNotContain(token, notice.Text);
        return notice;
    }

    [Fact]
    public async Task Troca_de_senha_avisa_a_dona_da_conta()
    {
        var email = NewEmail("troca");
        var other = NewEmail("outra");
        await api.RegisterAsync(email);
        await api.RegisterAsync(other);
        var otherSeen = api.Emails.CountFor(other);

        var notice = await ResetPasswordAsync(email);

        AssertNotice(notice, "A senha da sua conta no Kliny foi trocada", "https://kliny.test/esqueci-senha");
        await AssertNoNewEmailAsync(email, api.Emails.CountFor(email));
        await AssertNoNewEmailAsync(other, otherSeen);
    }

    [Fact]
    public async Task Aviso_sai_no_idioma_da_requisicao()
    {
        var email = NewEmail("ingles");
        await api.RegisterAsync(email);

        var notice = await ResetPasswordAsync(email, "en-US");

        Assert.Equal("Your Kliny password was changed", notice.Subject);
        Assert.Contains("Hello, Teste.", notice.Text);
    }

    [Fact]
    public async Task Vincular_e_desvincular_o_Google_avisam_uma_vez_cada()
    {
        var email = NewEmail("vinculo");
        var other = NewEmail("vizinha");
        var token = await api.RegisterAsync(email);
        await api.RegisterAsync(other);
        var otherSeen = api.Emails.CountFor(other);
        var seen = api.Emails.CountFor(email);

        // Recusado (comprovante inválido): nenhum aviso.
        using (var invalid = await PostAsync(token, "/api/auth/google/link", new { credential = "lixo" }))
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        // Sem vínculo, desvincular não muda nada: nenhum aviso.
        using (var nothing = await PostAsync(token, "/api/auth/google/unlink", new { }))
            Assert.Equal(HttpStatusCode.OK, nothing.StatusCode);
        await AssertNoNewEmailAsync(email, seen);

        var subject = $"g-{Guid.NewGuid():N}";
        using (var link = await PostAsync(token, "/api/auth/google/link", new { credential = Credential(subject, "pessoa@outlook.com") }))
            Assert.Equal(HttpStatusCode.OK, link.StatusCode);
        AssertNotice(await api.Emails.WaitForAsync(email, seen, Ct),
            "Uma conta Google foi vinculada à sua conta no Kliny", "https://kliny.test/configuracoes", "https://kliny.test/esqueci-senha");

        // A mesma conta Google de novo não muda nada: nenhum aviso.
        using (var again = await PostAsync(token, "/api/auth/google/link", new { credential = Credential(subject, "pessoa@outlook.com") }))
            Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        await AssertNoNewEmailAsync(email, seen + 1);

        using (var unlink = await PostAsync(token, "/api/auth/google/unlink", new { }))
            Assert.Equal(HttpStatusCode.OK, unlink.StatusCode);
        AssertNotice(await api.Emails.WaitForAsync(email, seen + 1, Ct),
            "A conta Google foi desvinculada da sua conta no Kliny", "https://kliny.test/esqueci-senha");

        await AssertNoNewEmailAsync(email, seen + 2);
        await AssertNoNewEmailAsync(other, otherSeen);
    }

    [Fact]
    public async Task Vinculo_automatico_no_login_com_o_Google_avisa()
    {
        // Gmail: o Google é a autoridade sobre o e-mail, e o primeiro login vincula a conta que já existe.
        var email = NewEmail("auto", "gmail.com");
        await api.RegisterAsync(email);
        var seen = api.Emails.CountFor(email);
        var credential = Credential($"g-{Guid.NewGuid():N}", email);

        using (var first = await PostAsync(null, "/api/auth/google", new { credential }))
            Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        AssertNotice(await api.Emails.WaitForAsync(email, seen, Ct), "Uma conta Google foi vinculada à sua conta no Kliny");

        // Já vinculada: os próximos logins com o Google não avisam.
        using (var second = await PostAsync(null, "/api/auth/google", new { credential }))
            Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        await AssertNoNewEmailAsync(email, seen + 1);
    }

    [Fact]
    public async Task Conta_nova_pelo_Google_nao_recebe_aviso()
    {
        // Criar a conta pelo Google não é vincular a uma conta que já existia: nada a avisar.
        var email = NewEmail("nova", "gmail.com");
        using (var created = await PostAsync(null, "/api/auth/google", new { credential = Credential($"g-{Guid.NewGuid():N}", email) }))
            Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        await AssertNoNewEmailAsync(email, 0);
    }
}
