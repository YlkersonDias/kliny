using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Backend.Tests;

public class RateLimitingTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static HttpRequestMessage LoginRequest(string? ip = null, string? language = null, string email = "ana@kliny.test")
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { email, password = "senha-errada" }),
        };
        if (ip is not null)
            request.Headers.Add(TestApp.ClientIpHeader, ip);
        if (language is not null)
            request.Headers.AcceptLanguage.ParseAdd(language);
        return request;
    }

    private static HttpRequestMessage RegisterRequest(int n) => new(HttpMethod.Post, "/api/auth/register")
    {
        Content = JsonContent.Create(new { name = "Ana", email = $"ana{n}@kliny.test" }),
    };

    private static async Task LoginTimes(HttpClient client, int times, string? ip = null)
    {
        for (var i = 0; i < times; i++)
        {
            using var response = await client.SendAsync(LoginRequest(ip), Ct);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    private static async Task<string?> Detail(HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return body.GetProperty("detail").GetString();
    }

    [Fact]
    public async Task Decima_primeira_tentativa_de_login_no_minuto_recebe_429()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        await LoginTimes(client, 10);

        using var response = await client.SendAsync(LoginRequest(), Ct);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal(TimeSpan.FromSeconds(60), response.Headers.RetryAfter?.Delta);
        Assert.Equal("Muitas tentativas. Tente novamente em 1 minuto.", await Detail(response));
    }

    [Fact]
    public async Task Mensagem_do_429_sai_em_ingles_com_accept_language()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        await LoginTimes(client, 10);

        using var response = await client.SendAsync(LoginRequest(language: "en-US"), Ct);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal("Too many attempts. Try again in 1 minute.", await Detail(response));
    }

    [Fact]
    public async Task Sexto_cadastro_na_hora_recebe_429()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        for (var i = 0; i < 5; i++)
        {
            using var created = await client.SendAsync(RegisterRequest(i), Ct);
            Assert.Equal(HttpStatusCode.Accepted, created.StatusCode);
        }

        using var response = await client.SendAsync(RegisterRequest(5), Ct);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal(TimeSpan.FromHours(1), response.Headers.RetryAfter?.Delta);
        Assert.Equal("Muitas tentativas. Tente novamente em 60 minutos.", await Detail(response));
    }

    [Fact]
    public async Task Recuperacao_de_senha_tem_limite_por_ip()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        for (var i = 0; i < 10; i++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, i % 2 == 0 ? "/api/auth/forgot-password" : "/api/auth/reset-password")
            {
                Content = i % 2 == 0
                    ? JsonContent.Create(new { email = $"ana{i}@kliny.test" })
                    : JsonContent.Create(new { token = "abc", password = "senha12345" }),
            };
            request.Headers.Add(TestApp.ClientIpHeader, "203.0.113.7");
            using var accepted = await client.SendAsync(request, Ct);
            Assert.Equal(HttpStatusCode.NoContent, accepted.StatusCode);
        }

        using var blocked = new HttpRequestMessage(HttpMethod.Post, "/api/auth/forgot-password") { Content = JsonContent.Create(new { email = "ana@kliny.test" }) };
        blocked.Headers.Add(TestApp.ClientIpHeader, "203.0.113.7");
        using var response = await client.SendAsync(blocked, Ct);
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal(TimeSpan.FromHours(1), response.Headers.RetryAfter?.Delta);

        using var otherIp = new HttpRequestMessage(HttpMethod.Post, "/api/auth/forgot-password") { Content = JsonContent.Create(new { email = "ana@kliny.test" }) };
        otherIp.Headers.Add(TestApp.ClientIpHeader, "203.0.113.8");
        using var other = await client.SendAsync(otherIp, Ct);
        Assert.Equal(HttpStatusCode.NoContent, other.StatusCode);
    }

    [Fact]
    public async Task Exportacao_tem_limite_por_ip()
    {
        // O limite vem antes da autenticação: sem token, as 5 primeiras respondem 401 e a 6ª, 429.
        using var app = new TestApp();
        var client = app.CreateClient();
        for (var i = 0; i < 5; i++)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, "/api/account/export");
            request.Headers.Add(TestApp.ClientIpHeader, "203.0.113.9");
            using var refused = await client.SendAsync(request, Ct);
            Assert.Equal(HttpStatusCode.Unauthorized, refused.StatusCode);
        }

        using var blocked = new HttpRequestMessage(HttpMethod.Get, "/api/account/export");
        blocked.Headers.Add(TestApp.ClientIpHeader, "203.0.113.9");
        using var response = await client.SendAsync(blocked, Ct);
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal(TimeSpan.FromHours(1), response.Headers.RetryAfter?.Delta);
    }

    [Fact]
    public async Task Ips_diferentes_tem_limites_separados()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        await LoginTimes(client, 10, ip: "203.0.113.1");

        using var blocked = await client.SendAsync(LoginRequest(ip: "203.0.113.1"), Ct);
        using var other = await client.SendAsync(LoginRequest(ip: "203.0.113.2"), Ct);

        Assert.Equal(HttpStatusCode.TooManyRequests, blocked.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, other.StatusCode);
    }

    [Fact]
    public async Task Ipv6_do_mesmo_prefixo_64_divide_o_limite()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        await LoginTimes(client, 10, ip: "2001:db8:1:2::1");

        using var sameNetwork = await client.SendAsync(LoginRequest(ip: "2001:db8:1:2:ffff::9"), Ct);

        Assert.Equal(HttpStatusCode.TooManyRequests, sameNetwork.StatusCode);
    }

    [Fact]
    public async Task Login_e_cadastro_tem_limites_separados()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        await LoginTimes(client, 10);

        using var response = await client.SendAsync(RegisterRequest(0), Ct);

        Assert.Equal(HttpStatusCode.Accepted, response.StatusCode);
    }

    [Fact]
    public async Task Me_nao_tem_limite()
    {
        using var app = new TestApp();
        var client = app.CreateClient();

        for (var i = 0; i < 30; i++)
        {
            using var response = await client.GetAsync("/api/auth/me", Ct);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    [Theory]
    [InlineData("RateLimits:LoginPerIp:PermitLimit", "0")]
    [InlineData("RateLimits:RegisterPerIp:WindowSeconds", "0")]
    [InlineData("RateLimits:LoginPerEmail:MaxFailures", "0")]
    public void Limite_invalido_impede_a_api_de_subir(string key, string value)
    {
        using var app = new TestApp(new Dictionary<string, string> { [key] = value });

        var error = Assert.ThrowsAny<Exception>(() => app.CreateClient());
        Assert.Contains(nameof(Backend.Options.RateLimitOptions), error.ToString());
    }

    [Fact]
    public async Task Email_bloqueado_recebe_429_com_o_tempo_restante()
    {
        using var app = new TestApp();
        var client = app.CreateClient();

        using var response = await client.SendAsync(LoginRequest(email: FakeAuthService.LockedEmail), Ct);

        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal(TimeSpan.FromMinutes(15), response.Headers.RetryAfter?.Delta);
        Assert.Equal("Muitas tentativas. Tente novamente em 15 minutos.", await Detail(response));
    }
}
