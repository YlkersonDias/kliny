using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace Backend.Tests;

// S.6: limites de tamanho no login e senha medida em bytes (o BCrypt só usa os primeiros 72).
public class AuthInputLimitsTests
{
    private const string TooLong = "A senha é longa demais: com acentos ou emojis, o limite de 72 caracteres fica menor.";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // 37 "é" = 37 caracteres (passa no limite de caracteres) e 74 bytes (passa do limite do BCrypt).
    private static readonly string AccentedPassword = new('é', 37);

    private static async Task<(HttpStatusCode Status, List<string> Messages)> PostAsync(string path, object body)
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        using var response = await client.PostAsJsonAsync(path, body, Ct);
        var messages = new List<string>();
        if (response.Content.Headers.ContentType?.MediaType == "application/problem+json")
        {
            var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
            if (problem.TryGetProperty("errors", out var errors))
                foreach (var field in errors.EnumerateObject())
                    messages.AddRange(field.Value.EnumerateArray().Select(m => m.GetString()!));
        }
        return (response.StatusCode, messages);
    }

    [Fact]
    public void Senha_com_acentos_passa_de_72_bytes_com_menos_de_72_caracteres()
    {
        Assert.Equal(37, AccentedPassword.Length);
        Assert.Equal(74, Encoding.UTF8.GetByteCount(AccentedPassword));
    }

    // Documenta por que o limite em bytes existe: o que passa de 72 bytes não muda o resultado.
    [Fact]
    public void Bcrypt_ignora_o_que_passa_de_72_bytes()
    {
        var prefix = new string('a', 72);
        var hash = BCrypt.Net.BCrypt.HashPassword(prefix + "X", workFactor: 4);

        Assert.True(BCrypt.Net.BCrypt.Verify(prefix + "outra coisa", hash));
    }

    [Fact]
    public async Task Cadastro_recusa_senha_acima_de_72_bytes()
    {
        var (status, messages) = await PostAsync("/api/auth/register/complete",
            new { token = "abc", password = AccentedPassword });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains(TooLong, messages);
    }

    [Fact]
    public async Task Cadastro_aceita_senha_de_exatos_72_bytes()
    {
        // 36 "é" = 72 bytes.
        var (status, _) = await PostAsync("/api/auth/register/complete",
            new { token = "abc", password = new string('é', 36) });

        Assert.Equal(HttpStatusCode.Created, status);
    }

    [Fact]
    public async Task Login_recusa_senha_acima_de_72_bytes()
    {
        var (status, messages) = await PostAsync("/api/auth/login",
            new { email = "ana@kliny.test", password = AccentedPassword });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains(TooLong, messages);
    }

    [Fact]
    public async Task Login_recusa_email_acima_de_255_caracteres()
    {
        var (status, messages) = await PostAsync("/api/auth/login",
            new { email = new string('a', 247) + "@kliny.test", password = "senha12345" });

        Assert.Equal(HttpStatusCode.BadRequest, status);
        Assert.Contains("O e-mail deve ter no máximo 255 caracteres.", messages);
    }

    [Fact]
    public async Task Login_dentro_dos_limites_segue_para_a_conferencia_da_senha()
    {
        // O IAuthService falso responde 401 (senha errada): a validação deixou passar.
        var (status, _) = await PostAsync("/api/auth/login",
            new { email = new string('a', 244) + "@kliny.test", password = new string('é', 36) });

        Assert.Equal(HttpStatusCode.Unauthorized, status);
    }
}
