using Backend.Data;
using Backend.Exceptions;
using Backend.Models;
using Backend.Options;
using Backend.Resources;
using Backend.Security;
using Backend.Services.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Backend.Services;

public interface IPasswordResetService
{
    /// <summary>
    /// Manda o link de troca de senha, se o e-mail tem conta. Não diz se tem (regra 4): o controller
    /// responde sempre igual, e o e-mail sai em segundo plano.
    /// </summary>
    Task RequestAsync(string email);

    /// <summary>Troca a senha pelo token do link e derruba todas as sessões do usuário.</summary>
    /// <exception cref="BusinessRuleException">Token inexistente, vencido ou já usado.</exception>
    Task ResetAsync(string token, string newPassword);
}

// Recuperação de senha. O token tem 256 bits aleatórios e vai só no e-mail; o banco guarda o
// SHA-256 dele. A tabela não tem o filtro global por usuário (como Users): quem usa o link não está
// logado, e a busca é sempre pelo hash.
public class PasswordResetService(
    AppDbContext db, IEmailQueue emailQueue, IOptions<EmailOptions> emailOptions, ILoginThrottle loginThrottle,
    ISecurityNotifier notifier, TimeProvider timeProvider, ILogger<PasswordResetService> logger) : IPasswordResetService
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(30);

    // No máximo 3 links por hora para a mesma conta: o limite por IP não impede alguém de encher a
    // caixa de e-mail de outra pessoa trocando de IP.
    public const int MaxPerHour = 3;

    public static string Hash(string token) => OneTimeToken.Hash(token);

    public async Task RequestAsync(string email)
    {
        var normalized = AuthService.NormalizeEmail(email);
        var now = timeProvider.GetUtcNow().UtcDateTime;

        // Links velhos não servem para nada: saem a cada pedido, de qualquer conta.
        await db.PasswordResetTokens.Where(t => t.CreatedAt < now.AddDays(-1)).ExecuteDeleteAsync();

        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == normalized);
        if (user is null)
            return;
        if (await db.PasswordResetTokens.CountAsync(t => t.UserId == user.Id && t.CreatedAt > now.AddHours(-1)) >= MaxPerHour)
            return;

        // Um link válido por vez: pedir outro encerra os anteriores.
        await db.PasswordResetTokens.Where(t => t.UserId == user.Id && t.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(t => t.ExpiresAt, now));

        var (token, hash) = OneTimeToken.Create();
        db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = hash,
            CreatedAt = now,
            ExpiresAt = now + Lifetime,
        });
        await db.SaveChangesAsync();

        // O token vai depois do "#": o navegador não manda essa parte ao servidor, então ela não
        // aparece nos logs do nginx nem da Cloudflare.
        var link = $"{emailOptions.Value.AppUrl.TrimEnd('/')}/redefinir-senha#{token}";
        var message = new EmailMessage(user.Email, Messages.PasswordResetSubject,
            string.Format(Messages.PasswordResetBody, user.Name, link, (int)Lifetime.TotalMinutes));
        if (!emailQueue.TryEnqueue(message))
            logger.LogWarning("Fila de e-mail cheia: um link de troca de senha não foi enviado.");
    }

    public async Task ResetAsync(string token, string newPassword)
    {
        var hash = Hash(token);
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var reset = await db.PasswordResetTokens.AsNoTracking()
            .FirstOrDefaultAsync(t => t.TokenHash == hash && t.ExpiresAt > now);
        if (reset is null)
            throw new BusinessRuleException(Messages.ResetTokenInvalid);

        // O BCrypt é lento: calculado antes da transação, para não segurar travas no banco.
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(newPassword, AuthService.BcryptWorkFactor);

        await using var transaction = await db.Database.BeginTransactionAsync();
        // Uso único: só quem apaga a linha troca a senha. Dois envios do mesmo link ao mesmo tempo:
        // o segundo não apaga nada e recebe o mesmo erro de link inválido.
        if (await db.PasswordResetTokens.Where(t => t.Id == reset.Id).ExecuteDeleteAsync() == 0)
            throw new BusinessRuleException(Messages.ResetTokenInvalid);

        // A senha nova derruba todas as sessões abertas (versão do token, S.5): se alguém tinha
        // entrado com a senha antiga, sai.
        await db.Users.Where(u => u.Id == reset.UserId).ExecuteUpdateAsync(s => s
            .SetProperty(u => u.PasswordHash, passwordHash)
            .SetProperty(u => u.TokenVersion, u => u.TokenVersion + 1));
        await db.PasswordResetTokens.Where(t => t.UserId == reset.UserId).ExecuteDeleteAsync();
        await transaction.CommitAsync();

        // Quem errou a senha até travar o login pode entrar com a nova na hora.
        var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == reset.UserId);
        loginThrottle.Reset(user.Email);

        // A dona da conta fica sabendo da troca, para reagir se não foi ela.
        notifier.PasswordChanged(user);
    }
}
