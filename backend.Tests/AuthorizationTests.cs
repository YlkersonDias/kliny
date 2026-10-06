using System.Net;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Backend.Tests;

// Vigia as rotas: só cadastro e login aceitam chamada sem login. Um endpoint novo sem proteção
// quebra estes testes (e o CI).
public partial class AuthorizationTests
{
    private static readonly HashSet<string> PublicEndpoints =
    [
        "POST api/auth/register",
        "POST api/auth/login",
    ];

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // "POST api/vaults/{id:int}/deposit" para cada método de cada rota.
    private static List<(string Method, string Pattern)> Routes(TestApp app)
    {
        app.CreateClient().Dispose();
        return app.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .SelectMany(endpoint => (endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()?.HttpMethods ?? ["GET"])
                .Select(method => (method, endpoint.RoutePattern.RawText!.TrimStart('/'))))
            .ToList();
    }

    [Fact]
    public void Politica_padrao_exige_usuario_autenticado()
    {
        using var app = new TestApp();
        app.CreateClient().Dispose();

        var fallback = app.Services.GetRequiredService<IOptions<AuthorizationOptions>>().Value.FallbackPolicy;

        Assert.NotNull(fallback);
        Assert.Contains(fallback.Requirements, r => r is Microsoft.AspNetCore.Authorization.Infrastructure.DenyAnonymousAuthorizationRequirement);
    }

    [Fact]
    public void So_cadastro_e_login_tem_AllowAnonymous()
    {
        using var app = new TestApp();
        app.CreateClient().Dispose();

        var anonymous = app.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(endpoint => endpoint.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            .SelectMany(endpoint => endpoint.Metadata.GetMetadata<IHttpMethodMetadata>()!.HttpMethods
                .Select(method => $"{method} {endpoint.RoutePattern.RawText!.TrimStart('/')}"))
            .ToHashSet();

        Assert.Equal(PublicEndpoints, anonymous);
    }

    // Development: inclui o /openapi/v1.json, que também precisa exigir login.
    [Theory]
    [InlineData("Testing")]
    [InlineData("Development")]
    public async Task Toda_rota_fora_cadastro_e_login_responde_401_sem_token(string environment)
    {
        using var app = new TestApp(environment: environment);
        var client = app.CreateClient();
        var routes = Routes(app);
        Assert.NotEmpty(routes);

        foreach (var (method, pattern) in routes.Where(r => !PublicEndpoints.Contains($"{r.Method} {r.Pattern}")))
        {
            // {id:int} e {documentName} viram "1": a autorização decide antes de ler o Id ou o corpo.
            var path = "/" + RouteParameter().Replace(pattern, "1");
            using var request = new HttpRequestMessage(new HttpMethod(method), path);
            if (method is "POST" or "PUT")
                request.Content = new StringContent("{}", System.Text.Encoding.UTF8, "application/json");

            using var response = await client.SendAsync(request, Ct);

            Assert.True(response.StatusCode == HttpStatusCode.Unauthorized,
                $"{method} {path} respondeu {(int)response.StatusCode} sem token.");
        }
    }

    [Fact]
    public async Task OpenApi_em_desenvolvimento_exige_login()
    {
        using var app = new TestApp(environment: "Development");
        var client = app.CreateClient();

        using var response = await client.GetAsync("/openapi/v1.json", Ct);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Cadastro_e_login_continuam_publicos()
    {
        using var app = new TestApp();
        var client = app.CreateClient();

        using var register = await client.PostAsync("/api/auth/register", Json("""{"name":"Ana","email":"ana@kliny.test","password":"senha12345"}"""), Ct);
        using var login = await client.PostAsync("/api/auth/login", Json("""{"email":"ana@kliny.test","password":"senha-errada"}"""), Ct);

        Assert.Equal(HttpStatusCode.Created, register.StatusCode);
        // 401 do próprio login (senha errada, pelo IAuthService falso), não da autorização.
        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        Assert.Equal("application/problem+json", login.Content.Headers.ContentType?.MediaType);
    }

    private static StringContent Json(string body) => new(body, System.Text.Encoding.UTF8, "application/json");

    [GeneratedRegex(@"\{[^}]+\}")]
    private static partial Regex RouteParameter();
}
