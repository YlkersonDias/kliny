using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Kliny.Api.Tests;

// X-Forwarded-For e X-Forwarded-Proto só valem vindos de um proxy das redes confiáveis: senão
// qualquer um fugiria do limite por IP.
public class ForwardedHeadersTests
{
    private const string Proxy = "172.30.0.10";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static TestApp App(string environment = "Testing") => new(new Dictionary<string, string>
    {
        ["ForwardedHeaders:KnownNetworks:0"] = "172.30.0.0/24",
    }, environment);

    private static HttpRequestMessage Login(string from, string? forwardedFor = null, string? forwardedProto = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { email = "ana@kliny.test", password = "senha-errada" }),
        };
        request.Headers.Add(TestApp.ClientIpHeader, from);
        if (forwardedFor is not null)
            request.Headers.Add("X-Forwarded-For", forwardedFor);
        if (forwardedProto is not null)
            request.Headers.Add("X-Forwarded-Proto", forwardedProto);
        return request;
    }

    private static async Task<HttpStatusCode> StatusAsync(HttpClient client, HttpRequestMessage request)
    {
        using var response = await client.SendAsync(request, Ct);
        return response.StatusCode;
    }

    [Fact]
    public async Task Pelo_proxy_confiavel_cada_visitante_tem_o_proprio_limite()
    {
        using var app = App();
        var client = app.CreateClient();

        for (var i = 0; i < 10; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, await StatusAsync(client, Login(Proxy, "203.0.113.7")));

        Assert.Equal(HttpStatusCode.TooManyRequests, await StatusAsync(client, Login(Proxy, "203.0.113.7")));
        Assert.Equal(HttpStatusCode.Unauthorized, await StatusAsync(client, Login(Proxy, "198.51.100.20")));
    }

    [Fact]
    public async Task De_fora_das_redes_confiaveis_o_X_Forwarded_For_e_ignorado()
    {
        using var app = App();
        var client = app.CreateClient();

        for (var i = 0; i < 10; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, await StatusAsync(client, Login("192.0.2.50", $"203.0.113.{i}")));

        Assert.Equal(HttpStatusCode.TooManyRequests, await StatusAsync(client, Login("192.0.2.50", "203.0.113.99")));
    }

    [Fact]
    public async Task Sem_redes_configuradas_nenhum_proxy_e_confiavel()
    {
        using var app = new TestApp();
        var client = app.CreateClient();

        for (var i = 0; i < 10; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, await StatusAsync(client, Login(Proxy, $"203.0.113.{i}")));

        Assert.Equal(HttpStatusCode.TooManyRequests, await StatusAsync(client, Login(Proxy, "203.0.113.99")));
    }

    // O nginx repassa em HTTP: o HSTS só sai pelo X-Forwarded-Proto do proxy confiável.
    [Theory]
    [InlineData(Proxy, true)]
    [InlineData("192.0.2.50", false)]
    public async Task Hsts_sai_com_o_X_Forwarded_Proto_do_proxy_confiavel(string from, bool expected)
    {
        using var app = App("Production");
        var client = app.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("http://kliny.test"),
            AllowAutoRedirect = false,
        });

        using var response = await client.SendAsync(Login(from, "203.0.113.7", "https"), Ct);

        Assert.Equal(expected, response.Headers.Contains("Strict-Transport-Security"));
    }
}
