using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Kliny.Api.Data;
using Kliny.Api.Security;
using Kliny.Api.Services.Email;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;

namespace Kliny.Api.Tests;

// A API com os services de verdade e um MySQL descartável (um banco por fixture). Como em produção,
// a API conecta com um usuário só de DML. O servidor vem de KLINY_TEST_MYSQL: sem ela, os testes
// são pulados, salvo no CI, onde a falta é erro.
public sealed partial class MySqlApi : IAsyncLifetime
{
    public const string ServerVariable = "KLINY_TEST_MYSQL";

    private static readonly MySqlServerVersion ServerVersion = new(new Version(8, 4, 0));

    private App? _app;
    private string _adminConnectionString = "";
    private string _appUser = "";

    public bool IsAvailable => _app is not null;

    public FakeEmailSender Emails { get; } = new();

    public string AppConnectionString
    {
        get
        {
            SkipIfUnavailable();
            return field;
        }
        private set;
    } = "";

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

        // Só hex de um Guid: entra no SQL abaixo sem risco (usuário do MySQL tem até 32 caracteres).
        var id = Guid.NewGuid().ToString("N");
        var database = $"kliny_test_{id}";
        _appUser = $"kliny_t_{id[..16]}";
        var appPassword = Guid.NewGuid().ToString("N");

        _adminConnectionString = new MySqlConnectionStringBuilder(server) { Database = database }.ConnectionString;
        // Variável local: o getter de AppConnectionString pula o teste enquanto _app é null.
        var appConnectionString = new MySqlConnectionStringBuilder(server)
        {
            Database = database,
            UserID = _appUser,
            Password = appPassword,
        }.ConnectionString;
        AppConnectionString = appConnectionString;

        await using (var admin = AdminContext())
        {
            await admin.Database.MigrateAsync(Ct);
            // O MySQL não aceita parâmetro no CREATE USER e no GRANT; os valores são só hex de um Guid.
#pragma warning disable EF1002
            await admin.Database.ExecuteSqlRawAsync(
                $"CREATE USER '{_appUser}'@'%' IDENTIFIED BY '{appPassword}'", Ct);
            await admin.Database.ExecuteSqlRawAsync(
                $"GRANT SELECT, INSERT, UPDATE, DELETE ON `{database}`.* TO '{_appUser}'@'%'", Ct);
#pragma warning restore EF1002
        }

        _app = new App(appConnectionString, Emails);
    }

    public async ValueTask DisposeAsync()
    {
        if (_app is null)
            return;

        await _app.DisposeAsync();
        await using (var pooled = new MySqlConnection(AppConnectionString))
            await MySqlConnection.ClearPoolAsync(pooled);
        await using var admin = AdminContext();
#pragma warning disable EF1002
        await admin.Database.ExecuteSqlRawAsync($"DROP USER IF EXISTS '{_appUser}'@'%'");
#pragma warning restore EF1002
        await admin.Database.EnsureDeletedAsync();
    }

    private AppDbContext AdminContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseMySql(_adminConnectionString, ServerVersion).Options);

    private void SkipIfUnavailable() =>
        Assert.SkipWhen(_app is null, $"Sem MySQL de teste ({ServerVariable}): roda no CI.");

    // Por padrão, todo depósito e retirada sem Idempotency-Key ganha uma chave nova; com
    // idempotencyKeys: false, a requisição sai como foi montada.
    public HttpClient Client(string? token = null, bool idempotencyKeys = true)
    {
        SkipIfUnavailable();
        var client = idempotencyKeys ? _app!.CreateDefaultClient(new IdempotencyKeyHandler()) : _app!.CreateClient();
        if (token is not null)
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public async Task<string> RegisterAsync(string email, string password = "senha12345")
    {
        using var client = Client();
        var seen = Emails.CountFor(email);
        using (var requested = await client.PostAsJsonAsync("/api/auth/register", new { name = "Teste", email }, Ct))
            requested.EnsureSuccessStatusCode();
        var message = await Emails.WaitForAsync(email, seen, Ct);
        var token = RegistrationLink().Match(message.Text).Groups[1].Value;
        using var response = await client.PostAsJsonAsync("/api/auth/register/complete", new { token, password }, Ct);
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return body.GetProperty("token").GetString()!;
    }

    [System.Text.RegularExpressions.GeneratedRegex("/criar-conta#([A-Za-z0-9_-]{43})")]
    public static partial System.Text.RegularExpressions.Regex RegistrationLink();

    private sealed class IdempotencyKeyHandler : DelegatingHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var path = request.RequestUri?.AbsolutePath ?? "";
            if (request.Method == HttpMethod.Post
                && (path.EndsWith("/deposit", StringComparison.Ordinal) || path.EndsWith("/withdraw", StringComparison.Ordinal))
                && !request.Headers.Contains(IdempotencyKey.Header))
                request.Headers.Add(IdempotencyKey.Header, Guid.NewGuid().ToString());
            return base.SendAsync(request, cancellationToken);
        }
    }

    private sealed class App(string connectionString, FakeEmailSender emails) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Jwt:Key", new string('k', 64));
            builder.UseSetting("AllowedHosts", "localhost;kliny.test");
            // Limites por IP altos: todos os testes vêm do mesmo IP. Os limites são conferidos no RateLimitingTests.
            builder.UseSetting("RateLimits:LoginPerIp:PermitLimit", "1000");
            builder.UseSetting("RateLimits:PasswordResetPerIp:PermitLimit", "1000");
            builder.UseSetting("RateLimits:RegisterPerIp:PermitLimit", "1000");
            builder.UseSetting("RateLimits:ExportPerIp:PermitLimit", "1000");
            builder.UseSetting("Email:AppUrl", "https://kliny.test");

            builder.ConfigureServices(services =>
            {
                foreach (var descriptor in services
                             .Where(d => d.ServiceType == typeof(IDbContextOptionsConfiguration<AppDbContext>))
                             .ToList())
                    services.Remove(descriptor);
                services.ConfigureDbContext<AppDbContext>(options =>
                    options.UseMySql(connectionString, ServerVersion));

                services.AddSingleton<IGoogleTokenValidator, FakeGoogleTokenValidator>();
                services.AddSingleton<IEmailSender>(emails);
            });
        }
    }
}
