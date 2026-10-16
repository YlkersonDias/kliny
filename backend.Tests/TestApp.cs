using System.Net;
using Backend.DTOs.Auth;
using Backend.Exceptions;
using Backend.Services;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Tests;

// A API inteira em memória, com o IAuthService trocado por um falso: não precisa de MySQL.
// Cada teste cria a sua, para os limites começarem do zero.
public sealed class TestApp(IReadOnlyDictionary<string, string>? settings = null, string environment = "Testing")
    : WebApplicationFactory<Program>
{
    // Cabeçalho só dos testes: define o IP de origem da requisição.
    public const string ClientIpHeader = "X-Test-Client-Ip";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Por padrão fora de Development: não lê o user-secrets da máquina (no CI ele nem existe).
        // Development só para o que só existe lá (o OpenAPI).
        builder.UseEnvironment(environment);
        builder.UseSetting("Jwt:Key", new string('k', 64));
        // O appsettings.json só aceita o Host localhost; alguns testes usam https://kliny.test.
        builder.UseSetting("AllowedHosts", "localhost;kliny.test");
        foreach (var (key, value) in settings ?? new Dictionary<string, string>())
            builder.UseSetting(key, value);

        builder.ConfigureServices(services =>
        {
            services.AddSingleton<IAuthService, FakeAuthService>();
            services.AddSingleton<IPasswordResetService, FakePasswordResetService>();
            services.AddSingleton<IRegistrationService, FakeRegistrationService>();
            services.AddSingleton<IStartupFilter, ClientIpStartupFilter>();
        });
    }

    private sealed class ClientIpStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                if (context.Request.Headers.TryGetValue(ClientIpHeader, out var ip))
                    context.Connection.RemoteIpAddress = IPAddress.Parse(ip.ToString());
                return nextMiddleware(context);
            });
            next(app);
        };
    }
}

// Login sempre errado (401), salvo o e-mail bloqueado (429) e o de falha (500); cadastro sempre aceito (201).
public sealed class FakeAuthService : IAuthService
{
    public const string LockedEmail = "bloqueado@kliny.test";
    public const string FailingEmail = "falha@kliny.test";

    public Task<AuthResponse?> LoginAsync(LoginRequest request) => request.Email switch
    {
        LockedEmail => throw new TooManyRequestsException(TimeSpan.FromMinutes(15)),
        FailingEmail => throw new InvalidOperationException("Falha simulada para o teste dos cabeçalhos no 500."),
        _ => Task.FromResult<AuthResponse?>(null),
    };

    public Task<UserResponse?> GetUserAsync(int userId) => Task.FromResult<UserResponse?>(null);

    public Task RevokeAllTokensAsync(int userId) => Task.CompletedTask;

    public Task DeleteAccountAsync(int userId, string? password, string? googleCredential) => Task.CompletedTask;

    public Task<AuthResponse?> GoogleSignInAsync(string credential) => Task.FromResult<AuthResponse?>(null);

    public Task<UserResponse> LinkGoogleAsync(int userId, string credential) =>
        Task.FromResult(new UserResponse(userId, "Teste", "teste@kliny.test", DateTime.UtcNow, GoogleLinked: true));

    public Task<UserResponse> UnlinkGoogleAsync(int userId) =>
        Task.FromResult(new UserResponse(userId, "Teste", "teste@kliny.test", DateTime.UtcNow));
}

// Recuperação de senha sem banco: só para os testes de limite e de rota, que não chegam ao service.
public sealed class FakePasswordResetService : IPasswordResetService
{
    public Task RequestAsync(string email) => Task.CompletedTask;

    public Task ResetAsync(string token, string newPassword) => Task.CompletedTask;
}

// Cadastro sem banco nem e-mail: só para os testes de limite, rota e validação.
public sealed class FakeRegistrationService : IRegistrationService
{
    public Task RequestAsync(string name, string email) => Task.CompletedTask;

    public Task<AuthResponse> CompleteAsync(string token, string password) =>
        Task.FromResult(new AuthResponse("token", DateTime.UtcNow.AddHours(1),
            new UserResponse(1, "Teste", "teste@kliny.test", DateTime.UtcNow)));
}
