using Backend.Models;
using Backend.Options;
using Backend.Resources;
using Backend.Services.Email;
using Microsoft.Extensions.Options;

namespace Backend.Services;

/// <summary>
/// Avisa a dona da conta, por e-mail, quando o acesso a ela muda, para ela reagir se não foi ela.
/// </summary>
public interface ISecurityNotifier
{
    void PasswordChanged(User user);
    void GoogleLinked(User user);
    void GoogleUnlinked(User user);
}

// Pela fila em segundo plano: uma falha no envio não desfaz a ação.
public sealed class SecurityNotifier(IEmailQueue emailQueue, IOptions<EmailOptions> emailOptions, ILogger<SecurityNotifier> logger)
    : ISecurityNotifier
{
    private string AppUrl => emailOptions.Value.AppUrl.TrimEnd('/');
    private string Support => emailOptions.Value.Support;

    public void PasswordChanged(User user) =>
        Enqueue(user, Messages.PasswordChangedSubject,
            string.Format(Messages.PasswordChangedBody, user.Name, $"{AppUrl}/esqueci-senha", Support));

    public void GoogleLinked(User user) =>
        Enqueue(user, Messages.GoogleLinkedSubject,
            string.Format(Messages.GoogleLinkedBody, user.Name, $"{AppUrl}/configuracoes", $"{AppUrl}/esqueci-senha", Support));

    public void GoogleUnlinked(User user) =>
        Enqueue(user, Messages.GoogleUnlinkedSubject,
            string.Format(Messages.GoogleUnlinkedBody, user.Name, $"{AppUrl}/esqueci-senha", Support));

    private void Enqueue(User user, string subject, string text)
    {
        if (!emailQueue.TryEnqueue(new EmailMessage(user.Email, subject, text)))
            logger.LogWarning("Fila de e-mail cheia: um aviso de segurança não foi enviado.");
    }
}
