using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Backend.Tests;

// S.7: atrás do nginx do deploy, o IP de quem acessa chega no X-Forwarded-For e o HTTPS no
// X-Forwarded-Proto. Só valem vindos de um proxy das redes de ForwardedHeaders:KnownNetworks;
// de qualquer outro endereço são ignorados, senão qualquer um fugiria do limite por IP.
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

        // O visitante que esgotou o limite é barrado; outro, pelo mesmo proxy, não.
        Assert.Equal(HttpStatusCode.TooManyRequests, await StatusAsync(client, Login(Proxy, "203.0.113.7")));
        Assert.Equal(HttpStatusCode.Unauthorized, await StatusAsync(client, Login(Proxy, "198.51.100.20")));
    }

    [Fact]
    public async Task De_fora_das_redes_confiaveis_o_X_Forwarded_For_e_ignorado()
    {
        using var app = App();
        var client = app.CreateClient();

        // Quem tenta trocar de "IP" a cada pedido continua contando no próprio endereço.
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

    // O nginx recebe HTTPS da Cloudflare pelo túnel e repassa em HTTP: o HSTS só sai porque o
    // X-Forwarded-Proto do proxy confiável diz que o pedido original era HTTPS.
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
