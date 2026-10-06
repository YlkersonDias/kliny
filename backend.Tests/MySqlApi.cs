using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Data;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Tests;

// A API inteira com os services de verdade e um MySQL descartável: um banco novo por execução
// (kliny_test_<guid>), criado pelas migrations e apagado no fim.
// O servidor vem de KLINY_TEST_MYSQL (sem Database), definida só no CI, onde o MySQL é um
// container de serviço. Sem ela os testes são pulados, salvo no CI, onde a falta é erro.
// Nunca usa o banco kliny nem os usuários kliny_app e kliny_migrator.
public sealed class MySqlApi : IAsyncLifetime
{
    public const string ServerVariable = "KLINY_TEST_MYSQL";

    private App? _app;

    public bool IsAvailable => _app is not null;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        var server = Environment.GetEnvironmentVariable(ServerVariable);
        if (string.IsNullOrWhiteSpace(server))
        {
            if (Environment.GetEnvironmentVariable("CI") == "true")
                throw new InvalidOperationException($"{ServerVariable} não definida no CI: os testes com MySQL não rodariam.");
            return;
        }

        _app = new App($"{server.TrimEnd(';')};Database=kliny_test_{Guid.NewGuid():N}");
        using var scope = _app.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.MigrateAsync(Ct);
    }

    public async ValueTask DisposeAsync()
    {
        if (_app is null)
            return;

        using (var scope = _app.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureDeletedAsync();
        await _app.DisposeAsync();
    }

    // Cliente sem token; pula o teste se não há MySQL de teste.
    public HttpClient Client(string? token = null)
    {
        Assert.SkipWhen(_app is null, $"Sem MySQL de teste ({ServerVariable}): roda no CI.");
        var client = _app!.CreateClient();
        if (token is not null)
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    // Cadastra e devolve o token. O cadastro tem limite de 5 por hora por IP: usar com moderação.
    public async Task<string> RegisterAsync(string email)
    {
        using var client = Client();
        using var response = await client.PostAsJsonAsync("/api/auth/register",
            new { name = "Teste", email, password = "senha12345" }, Ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return body.GetProperty("token").GetString()!;
    }

    private sealed class App(string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Jwt:Key", new string('k', 64));

            builder.ConfigureServices(services =>
            {
                // Troca a conexão do Program.cs (sem senha, do appsettings.json) pela do banco de teste.
                foreach (var descriptor in services
                             .Where(d => d.ServiceType == typeof(IDbContextOptionsConfiguration<AppDbContext>))
                             .ToList())
                    services.Remove(descriptor);
                services.ConfigureDbContext<AppDbContext>(options =>
                    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 4, 0))));
            });
        }
    }
}
