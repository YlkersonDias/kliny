using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Tests;

// S.4: cabeçalhos de segurança em toda resposta da API, inclusive erros, e HSTS fora de Development.
public partial class SecurityHeadersTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static void AssertSecurityHeaders(HttpResponseMessage response, string context)
    {
        string? Header(string name) =>
            response.Headers.TryGetValues(name, out var values) ? string.Join(", ", values) : null;

        Assert.True(response.Headers.CacheControl?.NoStore == true, $"{context}: sem Cache-Control: no-store.");
        Assert.True(Header("X-Content-Type-Options") == "nosniff", $"{context}: sem X-Content-Type-Options.");
        Assert.True(Header("Referrer-Policy") == "no-referrer", $"{context}: sem Referrer-Policy.");
        Assert.True(Header("Content-Security-Policy") == "default-src 'none'; frame-ancestors 'none'", $"{context}: sem a CSP da API.");
        Assert.True(Header("X-Frame-Options") == "DENY", $"{context}: sem X-Frame-Options.");
        Assert.True(Header("Cross-Origin-Resource-Policy") == "same-origin", $"{context}: sem Cross-Origin-Resource-Policy.");
        Assert.True(Header("Server") is null, $"{context}: com cabeçalho Server.");
    }

    [Fact]
    public async Task Toda_rota_responde_com_os_cabecalhos()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        var routes = app.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .SelectMany(endpoint => (endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods ?? ["GET"])
                .Select(method => (Method: method, Pattern: endpoint.RoutePattern.RawText!.TrimStart('/'))))
            .ToList();
        Assert.NotEmpty(routes);

        foreach (var (method, pattern) in routes)
        {
            var path = "/" + RouteParameter().Replace(pattern, "1");
            using var request = new HttpRequestMessage(new HttpMethod(method), path);
            if (method is "POST" or "PUT")
                request.Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json");

            using var response = await client.SendAsync(request, Ct);

            AssertSecurityHeaders(response, $"{method} {path} ({(int)response.StatusCode})");
        }
    }

    [Fact]
    public async Task Respostas_de_sucesso_e_de_erro_saem_com_os_cabecalhos()
    {
        using var app = new TestApp();
        var client = app.CreateClient();

        using var created = await client.PostAsJsonAsync("/api/auth/register",
            new { name = "Ana", email = "ana@kliny.test", password = "senha12345" }, Ct);
        using var invalid = await client.PostAsJsonAsync("/api/auth/register", new { name = "", email = "x", password = "1" }, Ct);
        using var notFound = await client.GetAsync("/nao-existe", Ct);
        using var failure = await client.PostAsJsonAsync("/api/auth/login",
            new { email = FakeAuthService.FailingEmail, password = "senha12345" }, Ct);
        using var tooMany = await client.PostAsJsonAsync("/api/auth/login",
            new { email = FakeAuthService.LockedEmail, password = "senha12345" }, Ct);

        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal(HttpStatusCode.InternalServerError, failure.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, tooMany.StatusCode);
        foreach (var (response, name) in new[] { (created, "201"), (invalid, "400"), (notFound, "rota inexistente"), (failure, "500"), (tooMany, "429") })
            AssertSecurityHeaders(response, name);
    }

    [Fact]
    public async Task Limite_por_ip_responde_429_com_os_cabecalhos()
    {
        using var app = new TestApp();
        var client = app.CreateClient();
        HttpResponseMessage? last = null;
        for (var i = 0; i < 11; i++)
        {
            last?.Dispose();
            last = await client.PostAsJsonAsync("/api/auth/login", new { email = "ana@kliny.test", password = "senha-errada" }, Ct);
        }

        Assert.Equal(HttpStatusCode.TooManyRequests, last!.StatusCode);
        AssertSecurityHeaders(last, "429 do limite por IP");
        last.Dispose();
    }

    // O UseHsts só manda o cabeçalho em HTTPS e fora de localhost; por isso o endereço https://kliny.test.
    [Theory]
    [InlineData("Production", true)]
    [InlineData("Development", false)]
    public async Task Hsts_de_30_dias_so_fora_de_development(string environment, bool expected)
    {
        using var app = new TestApp(environment: environment);
        var client = app.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://kliny.test") });

        using var response = await client.GetAsync("/api/auth/me", Ct);

        if (expected)
            Assert.Equal("max-age=2592000", Assert.Single(response.Headers.GetValues("Strict-Transport-Security")));
        else
            Assert.False(response.Headers.Contains("Strict-Transport-Security"));
    }

    [Fact]
    public async Task Hsts_nao_sai_em_http()
    {
        using var app = new TestApp(environment: "Production");
        var client = app.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("http://kliny.test"),
            AllowAutoRedirect = false,
        });

        using var response = await client.GetAsync("/api/auth/me", Ct);

        Assert.False(response.Headers.Contains("Strict-Transport-Security"));
    }

    [GeneratedRegex(@"\{[^}]+\}")]
    private static partial Regex RouteParameter();
}
