using Backend.Data;
using Backend.DTOs.Auth;
using Backend.Exceptions;
using Backend.Models;
using Backend.Resources;
using Backend.Security;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class AuthService(
    AppDbContext db, ITokenService tokenService, ILoginThrottle loginThrottle, IGoogleTokenValidator googleValidator,
    ISecurityNotifier notifier) : IAuthService
{
    public const int BcryptWorkFactor = 11;

    // Com e-mail sem conta, o login confere a senha contra este hash, de mesmo custo: o tempo da
    // resposta não revela quais e-mails têm conta.
    internal static readonly string TimingHash =
        BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"), BcryptWorkFactor);

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var email = NormalizeEmail(request.Email);

        // Bloqueio por e-mail: conta também e-mail sem conta, para não revelar quem está cadastrado.
        if (loginThrottle.GetLockout(email) is { } retryAfter)
            throw new TooManyRequestsException(retryAfter);

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email);

        // Sempre um BCrypt, mesmo sem conta ou sem senha (conta só do Google), para o tempo ser igual.
        var passwordMatches = BCrypt.Net.BCrypt.Verify(request.Password, user?.PasswordHash ?? TimingHash);
        if (user?.PasswordHash is null || !passwordMatches)
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

    public async Task DeleteAccountAsync(int userId, string? password, string? googleCredential)
    {
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);

        // Mesmo bloqueio do login: um token roubado não permite adivinhar a senha à vontade.
        if (loginThrottle.GetLockout(user.Email) is { } retryAfter)
            throw new TooManyRequestsException(retryAfter);

        if (user.PasswordHash is not null)
        {
            if (string.IsNullOrEmpty(password))
                throw new BusinessRuleException(Messages.PasswordRequired);
            if (!BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            {
                loginThrottle.RegisterFailure(user.Email);
                throw new BusinessRuleException(Messages.WrongPassword);
            }
        }
        else
        {
            // Conta só do Google confirma entrando de novo com a mesma conta do Google.
            var identity = string.IsNullOrEmpty(googleCredential) ? null : await googleValidator.ValidateAsync(googleCredential);
            if (identity is null || identity.Subject != user.GoogleSubject)
            {
                loginThrottle.RegisterFailure(user.Email);
                throw new BusinessRuleException(Messages.GoogleReauthFailed);
            }
        }

        // Movimentações antes do usuário: a chave cofre -> movimentação é RESTRICT.
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Transactions.Where(t => t.UserId == userId).ExecuteDeleteAsync();
        await db.Users.Where(u => u.Id == userId).ExecuteDeleteAsync();
        await transaction.CommitAsync();

        loginThrottle.Reset(user.Email);
    }

    public async Task<AuthResponse?> GoogleSignInAsync(string credential)
    {
        var identity = await googleValidator.ValidateAsync(credential);
        if (identity is null)
            return null;

        var linked = await db.Users.FirstOrDefaultAsync(u => u.GoogleSubject == identity.Subject);
        if (linked is not null)
            return BuildResponse(linked);

        // Daqui em diante o e-mail decide, então o Google precisa ser a autoridade sobre ele. As recusas
        // dão a mesma resposta, para não revelar se o e-mail tem conta.
        if (!identity.IsEmailAuthoritative)
            return null;

        var email = NormalizeEmail(identity.Email);
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (existing is not null)
        {
            if (existing.GoogleSubject is not null)
                return null;
            existing.GoogleSubject = identity.Subject;
            var (response, saved) = await SaveGoogleUserAsync(existing, identity.Subject);
            // No empate com outro login simultâneo, só quem gravou o vínculo avisa.
            if (saved)
                notifier.GoogleLinked(existing);
            return response;
        }

        var name = string.IsNullOrWhiteSpace(identity.Name) ? email.Split('@')[0] : identity.Name.Trim();
        var user = new User
        {
            Name = name.Length > 100 ? name[..100] : name,
            Email = email,
            GoogleSubject = identity.Subject,
            Categories = DefaultCategories.Create(),
        };
        db.Users.Add(user);
        return (await SaveGoogleUserAsync(user, identity.Subject)).Response;
    }

    // Dois logins simultâneos: quem perde no índice único entra pela conta que o outro gravou.
    private async Task<(AuthResponse? Response, bool Saved)> SaveGoogleUserAsync(User user, string subject)
    {
        try
        {
            await db.SaveChangesAsync();
            return (BuildResponse(user), true);
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            db.ChangeTracker.Clear();
            var winner = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.GoogleSubject == subject);
            return (winner is null ? null : BuildResponse(winner), false);
        }
    }

    public async Task<UserResponse> LinkGoogleAsync(int userId, string credential)
    {
        var identity = await googleValidator.ValidateAsync(credential)
            ?? throw new BusinessRuleException(Messages.GoogleLinkFailed);
        var user = await db.Users.FirstAsync(u => u.Id == userId);

        if (user.GoogleSubject == identity.Subject)
            return UserResponse.FromUser(user);
        if (user.GoogleSubject is not null)
            throw new ConflictException(Messages.GoogleLinkedToAnother);
        if (await db.Users.AnyAsync(u => u.GoogleSubject == identity.Subject))
            throw new ConflictException(Messages.GoogleAlreadyLinked);

        // A pessoa já provou as duas contas: aqui o Google não precisa ser autoridade sobre o e-mail.
        user.GoogleSubject = identity.Subject;
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            throw new ConflictException(Messages.GoogleAlreadyLinked);
        }
        notifier.GoogleLinked(user);
        return UserResponse.FromUser(user);
    }

    public async Task<UserResponse> UnlinkGoogleAsync(int userId)
    {
        var user = await db.Users.FirstAsync(u => u.Id == userId);
        // Sem senha, desvincular deixaria a conta sem forma de entrar.
        if (user.PasswordHash is null)
            throw new BusinessRuleException(Messages.GoogleUnlinkNeedsPassword);
        if (user.GoogleSubject is null)
            return UserResponse.FromUser(user);
        user.GoogleSubject = null;
        await db.SaveChangesAsync();
        notifier.GoogleUnlinked(user);
        return UserResponse.FromUser(user);
    }

    // Um UPDATE só, sem ler antes: chamadas simultâneas incrementam as duas vezes.
    public Task RevokeAllTokensAsync(int userId) =>
        db.Users.Where(u => u.Id == userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(u => u.TokenVersion, u => u.TokenVersion + 1));

    private AuthResponse BuildResponse(User user)
    {
        var (token, expiresAt) = tokenService.CreateToken(user);
        return new AuthResponse(token, expiresAt, UserResponse.FromUser(user));
    }

    internal static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
