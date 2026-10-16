using System.Net;

namespace Backend.Tests;

// AllowedHosts: fora da lista, a API recusa o pedido (400) antes de qualquer outra coisa. O padrão do
// appsettings.json é só localhost; o deploy põe os domínios do Kliny no docker-compose.yml.
public class HostFilteringTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Host_fora_da_lista_recebe_400()
    {
        // A mesma lista do appsettings.json (os outros testes acrescentam kliny.test).
        using var app = new TestApp(new Dictionary<string, string> { ["AllowedHosts"] = "localhost" });
        var client = app.CreateClient();

        using var local = await client.GetAsync("/api/auth/me", Ct);
        Assert.Equal(HttpStatusCode.Unauthorized, local.StatusCode);

        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/auth/me");
        request.Headers.Host = "atacante.example";
        using var other = await client.SendAsync(request, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, other.StatusCode);
    }

    [Fact]
    public void Appsettings_so_aceita_localhost()
    {
        // O que vale sem a configuração do deploy: um "*" aqui aceitaria qualquer Host.
        var path = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        using var json = System.Text.Json.JsonDocument.Parse(File.ReadAllText(path));
        Assert.Equal("localhost", json.RootElement.GetProperty("AllowedHosts").GetString());
    }
}
