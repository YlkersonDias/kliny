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
    // Custo do BCrypt (2^11 rodadas), o mesmo no cadastro e no hash fixo abaixo.
    public const int BcryptWorkFactor = 11;

    // S.6: com e-mail sem conta, o login confere a senha contra este hash, com o mesmo custo,
    // para levar o mesmo tempo que um e-mail cadastrado. Sem isso, medir o tempo da resposta
    // revelaria quais e-mails têm conta (regra 4). A senha dele é aleatória e descartada.
    internal static readonly string TimingHash =
        BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"), BcryptWorkFactor);

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var email = NormalizeEmail(request.Email);

        // E-mail bloqueado recusa até a senha certa; e-mail sem conta também é contado e bloqueado.
        if (loginThrottle.GetLockout(email) is { } retryAfter)
            throw new TooManyRequestsException(retryAfter);

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email);

        // Sempre um BCrypt: o hash do usuário, ou o fixo se o e-mail não tem conta ou a conta não
        // tem senha (criada só pelo Google), que nunca entra por aqui.
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
        // O token já foi validado (TokenVersionValidation), então o usuário existe.
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId);

        // Mesmo bloqueio do login: com um token roubado, não dá para adivinhar a senha à vontade.
        if (loginThrottle.GetLockout(user.Email) is { } retryAfter)
            throw new TooManyRequestsException(retryAfter);

        if (user.PasswordHash is not null)
        {
            // Conta com senha confirma com a senha, mesmo que tenha o Google vinculado.
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

        // As movimentações saem antes do usuário: a chave estrangeira cofre -> movimentação é
        // RESTRICT, e a cascata a partir do usuário esbarraria nela. Categorias e cofres saem pela
        // cascata do usuário. Tudo numa transação: ou some tudo, ou nada.
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

        // Já vinculada: entra pela conta do Google, mesmo que o e-mail dela tenha mudado.
        var linked = await db.Users.FirstOrDefaultAsync(u => u.GoogleSubject == identity.Subject);
        if (linked is not null)
            return BuildResponse(linked);

        // Daqui em diante o e-mail decide (vincular ou criar), então o Google precisa ser a
        // autoridade sobre ele. Os dois casos recusados dão a mesma resposta: não revela se o
        // e-mail tem conta (regra 4), e ninguém cria conta com o e-mail de outra pessoa.
        if (!identity.IsEmailAuthoritative)
            return null;

        var email = NormalizeEmail(identity.Email);
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (existing is not null)
        {
            // Já tem outra conta do Google vinculada: não troca sozinho.
            if (existing.GoogleSubject is not null)
                return null;
            existing.GoogleSubject = identity.Subject;
            var (response, saved) = await SaveGoogleUserAsync(existing, identity.Subject);
            // Só quem gravou o vínculo avisa: no empate com outro login simultâneo, um aviso só.
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
            // Conta nova pelo Google também nasce com as categorias padrão.
            Categories = DefaultCategories.Create(),
        };
        db.Users.Add(user);
        return (await SaveGoogleUserAsync(user, identity.Subject)).Response;
    }

    // Dois logins simultâneos com a mesma conta do Google podem tentar gravar juntos: quem perde
    // esbarra no índice único (do e-mail ou do Google) e entra pela conta que o outro gravou.
    // Saved: se foi esta requisição que gravou.
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

        // A pessoa já está logada no Kliny e acabou de provar que é dona da conta do Google:
        // aqui o e-mail da conta Google pode ser outro, e não precisa ser autoridade.
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
        // Sem senha, desvincular deixaria a conta sem nenhuma forma de entrar.
        if (user.PasswordHash is null)
            throw new BusinessRuleException(Messages.GoogleUnlinkNeedsPassword);
        // Sem conta Google vinculada, nada muda e não há o que avisar.
        if (user.GoogleSubject is null)
            return UserResponse.FromUser(user);
        user.GoogleSubject = null;
        await db.SaveChangesAsync();
        notifier.GoogleUnlinked(user);
        return UserResponse.FromUser(user);
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

    internal static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
