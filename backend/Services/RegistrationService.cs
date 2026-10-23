using System.Collections.Concurrent;
using Kliny.Api.Data;
using Kliny.Api.DTOs.Auth;
using Kliny.Api.Exceptions;
using Kliny.Api.Models;
using Kliny.Api.Options;
using Kliny.Api.Resources;
using Kliny.Api.Security;
using Kliny.Api.Services.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Kliny.Api.Services;

public interface IRegistrationService
{
    /// <summary>Manda o link de cadastro ou, se o e-mail já tem conta, um aviso; a resposta é sempre igual.</summary>
    Task RequestAsync(string name, string email);

    /// <summary>Cria a conta com a senha escolhida por quem recebeu o link.</summary>
    /// <exception cref="BusinessRuleException">Link inválido, vencido ou usado, ou e-mail que já virou conta.</exception>
    Task<AuthResponse> CompleteAsync(string token, string password);
}

public class RegistrationService(
    AppDbContext db, ITokenService tokenService, IEmailQueue emailQueue, IOptions<EmailOptions> emailOptions,
    RegistrationEmailThrottle throttle, TimeProvider timeProvider, ILogger<RegistrationService> logger) : IRegistrationService
{
    public static readonly TimeSpan Lifetime = TimeSpan.FromHours(24);

    public async Task RequestAsync(string name, string email)
    {
        var normalized = AuthService.NormalizeEmail(email);
        var now = timeProvider.GetUtcNow().UtcDateTime;

        await db.PendingRegistrations.Where(p => p.CreatedAt < now.AddDays(-2)).ExecuteDeleteAsync();

        // Limite por endereço: trocar de IP não permite encher a caixa de outra pessoa.
        if (!throttle.TryRegister(normalized))
            return;

        var appUrl = emailOptions.Value.AppUrl.TrimEnd('/');
        var existing = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == normalized);
        if (existing is not null)
        {
            Enqueue(new EmailMessage(existing.Email, Messages.AccountExistsSubject,
                string.Format(Messages.AccountExistsBody, existing.Name, $"{appUrl}/entrar", $"{appUrl}/esqueci-senha")));
            return;
        }

        await db.PendingRegistrations.Where(p => p.Email == normalized && p.ExpiresAt > now)
            .ExecuteUpdateAsync(s => s.SetProperty(p => p.ExpiresAt, now));

        var (token, hash) = OneTimeToken.Create();
        var cleanName = name.Trim();
        db.PendingRegistrations.Add(new PendingRegistration
        {
            Email = normalized,
            Name = cleanName,
            TokenHash = hash,
            CreatedAt = now,
            ExpiresAt = now + Lifetime,
        });
        await db.SaveChangesAsync();

        // O token vai depois do "#", fora dos logs do nginx e da Cloudflare.
        Enqueue(new EmailMessage(normalized, Messages.RegistrationSubject,
            string.Format(Messages.RegistrationBody, $"{appUrl}/criar-conta#{token}", (int)Lifetime.TotalHours)));
    }

    public async Task<AuthResponse> CompleteAsync(string token, string password)
    {
        var hash = OneTimeToken.Hash(token);
        var now = timeProvider.GetUtcNow().UtcDateTime;
        var pending = await db.PendingRegistrations.AsNoTracking()
            .FirstOrDefaultAsync(p => p.TokenHash == hash && p.ExpiresAt > now);
        if (pending is null)
            throw new BusinessRuleException(Messages.RegistrationTokenInvalid);

        // BCrypt antes da transação, para não segurar travas no banco.
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(password, AuthService.BcryptWorkFactor);

        await using var transaction = await db.Database.BeginTransactionAsync();
        // Uso único: só quem apaga a linha cria a conta.
        if (await db.PendingRegistrations.Where(p => p.Id == pending.Id).ExecuteDeleteAsync() == 0)
            throw new BusinessRuleException(Messages.RegistrationTokenInvalid);

        // O e-mail pode ter virado conta enquanto o link esperava (pelo Google, por exemplo).
        if (await db.Users.AnyAsync(u => u.Email == pending.Email))
            throw await AlreadyRegisteredAsync(transaction, pending.Email);

        var user = new User { Name = pending.Name, Email = pending.Email, PasswordHash = passwordHash, Categories = DefaultCategories.Create() };
        db.Users.Add(user);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            db.ChangeTracker.Clear();
            throw await AlreadyRegisteredAsync(transaction, pending.Email);
        }

        await db.PendingRegistrations.Where(p => p.Email == pending.Email).ExecuteDeleteAsync();
        await transaction.CommitAsync();

        var (jwt, expiresAt) = tokenService.CreateToken(user);
        return new AuthResponse(jwt, expiresAt, UserResponse.FromUser(user));
    }

    private async Task<BusinessRuleException> AlreadyRegisteredAsync(
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction, string email)
    {
        await db.PendingRegistrations.Where(p => p.Email == email).ExecuteDeleteAsync();
        await transaction.CommitAsync();
        return new BusinessRuleException(Messages.RegistrationAlreadyDone);
    }

    private void Enqueue(EmailMessage message)
    {
        if (!emailQueue.TryEnqueue(message))
            logger.LogWarning("Fila de e-mail cheia: um e-mail de cadastro não foi enviado.");
    }
}

// Na memória: some ao reiniciar e vale para um servidor só.
public sealed class RegistrationEmailThrottle(TimeProvider timeProvider)
{
    public const int MaxPerHour = 3;
    private const int MaxTracked = 10_000;
    private readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> _sent = new();

    public bool TryRegister(string email)
    {
        var now = timeProvider.GetUtcNow();
        if (_sent.Count > MaxTracked)
            foreach (var (key, times) in _sent)
                lock (times)
                    if (times.All(t => t <= now.AddHours(-1)))
                        _sent.TryRemove(key, out _);

        var queue = _sent.GetOrAdd(email, _ => new Queue<DateTimeOffset>());
        lock (queue)
        {
            while (queue.Count > 0 && queue.Peek() <= now.AddHours(-1))
                queue.Dequeue();
            if (queue.Count >= MaxPerHour)
                return false;
            queue.Enqueue(now);
            return true;
        }
    }
}
