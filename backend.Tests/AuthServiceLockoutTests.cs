using Backend.Data;
using Backend.DTOs.Auth;
using Backend.Exceptions;
using Backend.Models;
using Backend.Options;
using Backend.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace Backend.Tests;

// O AuthService com o LoginThrottle de verdade e o banco em memória do EF (sem MySQL).
public class AuthServiceLockoutTests : IDisposable
{
    private const string Email = "ana@kliny.test";
    private const string Password = "senha-certa-123";

    private readonly AppDbContext _db;
    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 10, 6, 12, 0, 0, TimeSpan.Zero));
    private readonly AuthService _auth;

    public AuthServiceLockoutTests()
    {
        _db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        _db.Users.Add(new User
        {
            Name = "Ana",
            Email = Email,
            // Custo mínimo: os testes não medem o BCrypt.
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Password, workFactor: 4),
        });
        _db.SaveChanges();

        var tokens = new TokenService(MsOptions.Create(new JwtOptions
        {
            Issuer = "Kliny",
            Audience = "Kliny",
            Key = new string('k', 64),
        }));
        var throttle = new LoginThrottle(MsOptions.Create(new RateLimitOptions()), _time);
        _auth = new AuthService(_db, tokens, throttle);
    }

    public void Dispose() => _db.Dispose();

    private Task<AuthResponse?> Login(string email, string password) =>
        _auth.LoginAsync(new LoginRequest { Email = email, Password = password });

    private async Task FailTimes(int times, string email = Email)
    {
        for (var i = 0; i < times; i++)
            Assert.Null(await Login(email, "senha-errada"));
    }

    [Fact]
    public async Task Senha_certa_entra()
    {
        Assert.NotNull(await Login(Email, Password));
    }

    [Fact]
    public async Task Depois_de_5_falhas_ate_a_senha_certa_e_recusada()
    {
        await FailTimes(5);

        var error = await Assert.ThrowsAsync<TooManyRequestsException>(() => Login(Email, Password));
        Assert.Equal(TimeSpan.FromMinutes(15), error.RetryAfter);
    }

    [Fact]
    public async Task Depois_do_bloqueio_a_senha_certa_volta_a_entrar()
    {
        await FailTimes(5);
        _time.Advance(TimeSpan.FromMinutes(15));

        Assert.NotNull(await Login(Email, Password));
    }

    [Fact]
    public async Task Login_certo_zera_as_falhas()
    {
        await FailTimes(4);
        Assert.NotNull(await Login(Email, Password));
        await FailTimes(4);

        Assert.NotNull(await Login(Email, Password));
    }

    [Fact]
    public async Task Email_sem_conta_tambem_e_bloqueado()
    {
        // Mesmo comportamento com ou sem conta: o bloqueio não revela quem está cadastrado.
        await FailTimes(5, "ninguem@kliny.test");

        await Assert.ThrowsAsync<TooManyRequestsException>(() => Login("ninguem@kliny.test", "qualquer"));
    }

    [Fact]
    public async Task Email_com_maiusculas_e_espacos_conta_como_o_mesmo()
    {
        await FailTimes(3, "  ANA@kliny.test ");
        await FailTimes(2, "Ana@Kliny.Test");

        await Assert.ThrowsAsync<TooManyRequestsException>(() => Login(Email, Password));
    }
}
