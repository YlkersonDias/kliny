using Backend.Models;
using Backend.Options;
using Backend.Resources;
using Backend.Services.Email;
using Microsoft.Extensions.Options;

namespace Backend.Services;

/// <summary>
/// Avisa a dona da conta, por e-mail, quando o acesso a ela muda (senha trocada, conta Google
/// vinculada ou desvinculada), para ela reagir se não foi ela. Vai só para o e-mail da própria
/// conta, com o nome dela, e não muda nenhuma resposta da API (regra 4).
/// </summary>
public interface ISecurityNotifier
{
    void PasswordChanged(User user);
    void GoogleLinked(User user);
    void GoogleUnlinked(User user);
}

// O envio é pela mesma fila em segundo plano dos outros e-mails: uma falha no envio não desfaz a
// ação, e o log não leva destinatário nem texto (regra 16).
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
