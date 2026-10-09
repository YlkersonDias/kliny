using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Data;
using Backend.Security;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using MySqlConnector;

namespace Backend.Tests;

// A API inteira com os services de verdade e um MySQL descartável: um banco novo por fixture
// (kliny_test_<guid>), criado pelas migrations e apagado no fim.
// Como em produção, a API conecta com um usuário só de DML (SELECT, INSERT, UPDATE, DELETE no
// banco de teste), igual ao kliny_app; as migrations rodam com o usuário administrador, como
// faria o kliny_migrator. Se o app passar a precisar de DDL, os testes quebram.
// O servidor vem de KLINY_TEST_MYSQL (sem Database, com um usuário que cria bancos e usuários),
// definida só no CI, onde o MySQL é um container de serviço. Sem ela os testes são pulados,
// salvo no CI, onde a falta é erro. Nunca usa o banco kliny nem os usuários kliny_app e kliny_migrator.
public sealed class MySqlApi : IAsyncLifetime
{
    public const string ServerVariable = "KLINY_TEST_MYSQL";

    private static readonly MySqlServerVersion ServerVersion = new(new Version(8, 4, 0));

    private App? _app;
    private string _adminConnectionString = "";
    private string _appUser = "";

    public bool IsAvailable => _app is not null;

    // Conexão do usuário só de DML, a mesma que a API usa.
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

        // Nomes só com hex do Guid: entram no SQL abaixo sem risco. Usuário do MySQL tem até 32 caracteres.
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
            // Usuário, senha e nome do banco são literais/identificadores: o MySQL não aceita
            // parâmetro vinculado nessas posições do CREATE USER e do GRANT. Sem risco de injeção,
            // porque os três vêm só de hex de um Guid gerado aqui, nunca de entrada do usuário.
#pragma warning disable EF1002
            await admin.Database.ExecuteSqlRawAsync(
                $"CREATE USER '{_appUser}'@'%' IDENTIFIED BY '{appPassword}'", Ct);
            await admin.Database.ExecuteSqlRawAsync(
                $"GRANT SELECT, INSERT, UPDATE, DELETE ON `{database}`.* TO '{_appUser}'@'%'", Ct);
#pragma warning restore EF1002
        }

        _app = new App(appConnectionString);
    }

    public async ValueTask DisposeAsync()
    {
        if (_app is null)
            return;

        await _app.DisposeAsync();
        // Fecha as conexões ociosas do usuário de teste antes de apagá-lo junto com o banco.
        await using (var pooled = new MySqlConnection(AppConnectionString))
            await MySqlConnection.ClearPoolAsync(pooled);
        await using var admin = AdminContext();
        // Mesmo motivo do CREATE USER: nome de usuário não aceita parâmetro vinculado aqui.
#pragma warning disable EF1002
        await admin.Database.ExecuteSqlRawAsync($"DROP USER IF EXISTS '{_appUser}'@'%'");
#pragma warning restore EF1002
        await admin.Database.EnsureDeletedAsync();
    }

    private AppDbContext AdminContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseMySql(_adminConnectionString, ServerVersion).Options);

    private void SkipIfUnavailable() =>
        Assert.SkipWhen(_app is null, $"Sem MySQL de teste ({ServerVariable}): roda no CI.");

    // Cliente sem token; pula o teste se não há MySQL de teste. Por padrão, todo depósito e retirada
    // sem Idempotency-Key ganha uma chave nova (cada envio é uma intenção diferente); com
    // idempotencyKeys: false, a requisição sai como foi montada, para testar a falta da chave.
    public HttpClient Client(string? token = null, bool idempotencyKeys = true)
    {
        SkipIfUnavailable();
        var client = idempotencyKeys ? _app!.CreateDefaultClient(new IdempotencyKeyHandler()) : _app!.CreateClient();
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

    private sealed class App(string connectionString) : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("Jwt:Key", new string('k', 64));
            // O login com o Google, o vínculo e a exclusão de conta dividem o limite por IP do login
            // (10 por minuto), e cada classe de teste faz mais que isso. O limite por IP é conferido
            // no RateLimitingTests, sem MySQL; o bloqueio por e-mail continua o de produção.
            builder.UseSetting("RateLimits:LoginPerIp:PermitLimit", "1000");

            builder.ConfigureServices(services =>
            {
                // Troca a conexão do Program.cs (sem senha, do appsettings.json) pela do banco de teste.
                foreach (var descriptor in services
                             .Where(d => d.ServiceType == typeof(IDbContextOptionsConfiguration<AppDbContext>))
                             .ToList())
                    services.Remove(descriptor);
                services.ConfigureDbContext<AppDbContext>(options =>
                    options.UseMySql(connectionString, ServerVersion));

                // Os testes não falam com o Google: o comprovante é montado pelo FakeGoogleTokenValidator.
                services.AddSingleton<IGoogleTokenValidator, FakeGoogleTokenValidator>();
            });
        }
    }
}
