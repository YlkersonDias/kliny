using System.Collections.Concurrent;
using Backend.Services.Email;

namespace Backend.Tests;

// Os testes nunca falam com o Resend.
public sealed class FakeEmailSender : IEmailSender
{
    private readonly ConcurrentQueue<EmailMessage> _sent = new();

    public IReadOnlyList<EmailMessage> Sent => [.. _sent];

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        _sent.Enqueue(message);
        return Task.CompletedTask;
    }

    // O envio é em segundo plano: espera a mensagem chegar.
    public async Task<EmailMessage> WaitForAsync(string to, int alreadySeen, CancellationToken cancellationToken)
    {
        for (var i = 0; i < 100; i++)
        {
            var mine = Sent.Where(m => m.To == to).ToList();
            if (mine.Count > alreadySeen)
                return mine[^1];
            await Task.Delay(50, cancellationToken);
        }
        throw new TimeoutException($"Nenhum e-mail novo para {to}.");
    }

    public int CountFor(string to) => Sent.Count(m => m.To == to);

    // Um aviso de segurança que chegue atrasado não é confundido com o e-mail do link.
    public async Task<EmailMessage> WaitForAsync(string to, int alreadySeen, Func<EmailMessage, bool> match, CancellationToken cancellationToken)
    {
        for (var i = 0; i < 100; i++)
        {
            var found = Sent.Where(m => m.To == to).Skip(alreadySeen).LastOrDefault(match);
            if (found is not null)
                return found;
            await Task.Delay(50, cancellationToken);
        }
        throw new TimeoutException($"Nenhum e-mail novo do tipo esperado para {to}.");
    }
}
