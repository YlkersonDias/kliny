using Backend.Data;
using Backend.DTOs.Auth;
using Backend.Exceptions;
using Backend.Models;
using Backend.Resources;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class AuthService(AppDbContext db, ITokenService tokenService, ILoginThrottle loginThrottle) : IAuthService
{
    // Custo do BCrypt (2^11 rodadas), o mesmo no cadastro e no hash fixo abaixo.
    public const int BcryptWorkFactor = 11;

    // S.6: com e-mail sem conta, o login confere a senha contra este hash, com o mesmo custo,
    // para levar o mesmo tempo que um e-mail cadastrado. Sem isso, medir o tempo da resposta
    // revelaria quais e-mails têm conta (regra 4). A senha dele é aleatória e descartada.
    internal static readonly string TimingHash =
        BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"), BcryptWorkFactor);

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var email = NormalizeEmail(request.Email);

        if (await db.Users.AnyAsync(u => u.Email == email))
            throw new ConflictException(Messages.EmailInUse);

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, BcryptWorkFactor),
        };

        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            throw new ConflictException(Messages.EmailInUse);
        }

        return BuildResponse(user);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var email = NormalizeEmail(request.Email);

        // E-mail bloqueado recusa até a senha certa; e-mail sem conta também é contado e bloqueado.
        if (loginThrottle.GetLockout(email) is { } retryAfter)
            throw new TooManyRequestsException(retryAfter);

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email);

        // Sempre um BCrypt: o hash do usuário, ou o fixo se o e-mail não tem conta.
        var passwordMatches = BCrypt.Net.BCrypt.Verify(request.Password, user?.PasswordHash ?? TimingHash);
        if (user is null || !passwordMatches)
        {
            loginThrottle.RegisterFailure(email);
            return null;
        }

        loginThrottle.Reset(email);
        return BuildResponse(user);
    }

    public async Task<UserResponse?> GetUserAsync(int userId)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        return user is null ? null : UserResponse.FromUser(user);
    }

    // Um UPDATE só, sem ler antes: duas chamadas simultâneas incrementam as duas vezes.
    public Task RevokeAllTokensAsync(int userId) =>
        db.Users.Where(u => u.Id == userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(u => u.TokenVersion, u => u.TokenVersion + 1));

    private AuthResponse BuildResponse(User user)
    {
        var (token, expiresAt) = tokenService.CreateToken(user);
        return new AuthResponse(token, expiresAt, UserResponse.FromUser(user));
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
