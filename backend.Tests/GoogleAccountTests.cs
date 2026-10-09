using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static Backend.Tests.FakeGoogleTokenValidator;

namespace Backend.Tests;

// Vincular, desvincular e excluir conta com o Google, contra o MySQL, com o validador falso.
// O teste de que outra pessoa não mexe no vínculo fica no OwnershipTests (regra 19).
// 3 cadastros nesta classe.
public class GoogleAccountTests(MySqlApi api) : IClassFixture<MySqlApi>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<(string Token, int Id)> GoogleOnlyAsync(string subject, string email)
    {
        using var client = api.Client();
        using var response = await client.PostAsJsonAsync("/api/auth/google", new { credential = Credential(subject, email) }, Ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return (body.GetProperty("token").GetString()!, body.GetProperty("user").GetProperty("id").GetInt32());
    }

    private async Task<HttpResponseMessage> PostAsync(string? token, string path, object body)
    {
        using var client = api.Client(token);
        return await client.PostAsJsonAsync(path, body, Ct);
    }

    private async Task<JsonElement> MeAsync(string token)
    {
        using var client = api.Client(token);
        return await client.GetFromJsonAsync<JsonElement>("/api/auth/me", Ct);
    }

    private static async Task<string?> DetailOf(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("detail").GetString();

    [Fact]
    public async Task Vincula_e_desvincula_conta_com_senha()
    {
        var token = await api.RegisterAsync("senha-google@kliny.test");
        var id = (await MeAsync(token)).GetProperty("id").GetInt32();

        // Comprovante inválido: nada muda.
        using (var invalid = await PostAsync(token, "/api/auth/google/link", new { credential = "lixo" }))
        {
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
            Assert.Equal("Não foi possível confirmar a conta do Google. Tente de novo.", await DetailOf(invalid));
        }

        // Logada, a pessoa pode vincular uma conta Google de outro e-mail, mesmo sem autoridade.
        using (var link = await PostAsync(token, "/api/auth/google/link", new { credential = Credential("g-link", "pessoa@outlook.com") }))
        {
            Assert.Equal(HttpStatusCode.OK, link.StatusCode);
            Assert.True((await link.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("googleLinked").GetBoolean());
        }

        // Vincular de novo a mesma conta não muda nada.
        using (var again = await PostAsync(token, "/api/auth/google/link", new { credential = Credential("g-link", "pessoa@outlook.com") }))
            Assert.Equal(HttpStatusCode.OK, again.StatusCode);

        using (var signIn = await PostAsync(null, "/api/auth/google", new { credential = Credential("g-link", "pessoa@outlook.com") }))
        {
            Assert.Equal(HttpStatusCode.OK, signIn.StatusCode);
            Assert.Equal(id, (await signIn.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("user").GetProperty("id").GetInt32());
        }

        // Outra conta do Google com a primeira ainda vinculada: 409.
        using (var second = await PostAsync(token, "/api/auth/google/link", new { credential = Credential("g-link-2", "x@gmail.com") }))
        {
            Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
            Assert.Equal("Sua conta já tem outra conta do Google vinculada. Desvincule-a antes.", await DetailOf(second));
        }

        using (var unlink = await PostAsync(token, "/api/auth/google/unlink", new { }))
        {
            Assert.Equal(HttpStatusCode.OK, unlink.StatusCode);
            Assert.False((await unlink.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("googleLinked").GetBoolean());
        }

        // Desvinculada, a conta Google (de e-mail sem autoridade) não entra mais nem cria conta.
        using var after = await PostAsync(null, "/api/auth/google", new { credential = Credential("g-link", "pessoa@outlook.com") });
        Assert.Equal(HttpStatusCode.Unauthorized, after.StatusCode);
    }

    [Fact]
    public async Task Conta_so_do_Google_nao_pode_desvincular()
    {
        var (token, _) = await GoogleOnlyAsync("g-so", "so-google@gmail.com");

        using var unlink = await PostAsync(token, "/api/auth/google/unlink", new { });

        Assert.Equal(HttpStatusCode.BadRequest, unlink.StatusCode);
        Assert.True((await MeAsync(token)).GetProperty("googleLinked").GetBoolean());
    }

    [Fact]
    public async Task Excluir_conta_so_do_Google_exige_entrar_de_novo_com_o_mesmo_Google()
    {
        var (token, id) = await GoogleOnlyAsync("g-excluir", "excluir-google@gmail.com");
        const string reauthFailed = "Entre com a mesma conta do Google vinculada a esta conta para confirmar.";

        using (var nothing = await PostAsync(token, "/api/auth/delete-account", new { }))
        {
            Assert.Equal(HttpStatusCode.BadRequest, nothing.StatusCode);
            Assert.Equal(reauthFailed, await DetailOf(nothing));
        }

        // Senha não serve: a conta não tem senha.
        using (var password = await PostAsync(token, "/api/auth/delete-account", new { password = "senha12345" }))
            Assert.Equal(reauthFailed, await DetailOf(password));

        using (var otherGoogle = await PostAsync(token, "/api/auth/delete-account",
                   new { googleCredential = Credential("g-outro", "excluir-google@gmail.com") }))
            Assert.Equal(reauthFailed, await DetailOf(otherGoogle));
        Assert.Equal(id, (await MeAsync(token)).GetProperty("id").GetInt32());

        using (var deleted = await PostAsync(token, "/api/auth/delete-account",
                   new { googleCredential = Credential("g-excluir", "excluir-google@gmail.com") }))
            Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);

        using var client = api.Client(token);
        using var me = await client.GetAsync("/api/auth/me", Ct);
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);

        // Entrar de novo com o Google cria uma conta nova, vazia.
        var (_, newId) = await GoogleOnlyAsync("g-excluir", "excluir-google@gmail.com");
        Assert.NotEqual(id, newId);
    }

    [Fact]
    public async Task Excluir_conta_com_senha_continua_exigindo_a_senha()
    {
        var token = await api.RegisterAsync("senha-e-google@gmail.com");
        using (var link = await PostAsync(token, "/api/auth/google/link", new { credential = Credential("g-senha", "senha-e-google@gmail.com") }))
            Assert.Equal(HttpStatusCode.OK, link.StatusCode);

        // Com senha, o Google não substitui a senha na confirmação.
        using (var onlyGoogle = await PostAsync(token, "/api/auth/delete-account",
                   new { googleCredential = Credential("g-senha", "senha-e-google@gmail.com") }))
        {
            Assert.Equal(HttpStatusCode.BadRequest, onlyGoogle.StatusCode);
            Assert.Equal("Informe a senha.", await DetailOf(onlyGoogle));
        }

        using var deleted = await PostAsync(token, "/api/auth/delete-account", new { password = "senha12345" });
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
    }

    [Fact]
    public async Task Vincular_exige_login()
    {
        using var link = await PostAsync(null, "/api/auth/google/link", new { credential = Credential("g-anon", "anon@gmail.com") });
        using var unlink = await PostAsync(null, "/api/auth/google/unlink", new { });

        Assert.Equal(HttpStatusCode.Unauthorized, link.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unlink.StatusCode);
    }
}
