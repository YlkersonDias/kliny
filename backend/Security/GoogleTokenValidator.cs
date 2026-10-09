using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace Backend.Security;

// Quem o comprovante do Google (ID token) diz que a pessoa é, já conferido.
// Subject ("sub") é o identificador fixo da conta Google: o Google pede para usá-lo, e não o e-mail,
// que pode mudar. HostedDomain ("hd") só vem em contas do Google Workspace.
public record GoogleIdentity(string Subject, string Email, bool EmailVerified, string? HostedDomain, string? Name)
{
    // O Google só é autoridade sobre o e-mail de contas @gmail.com e do Workspace com e-mail
    // verificado (documentação do Sign In With Google). Fora disso, o e-mail não prova que a
    // pessoa é dona dele: nem vincula a uma conta existente, nem cria conta nova.
    public bool IsEmailAuthoritative =>
        EmailVerified
        && (Email.Trim().EndsWith("@gmail.com", StringComparison.OrdinalIgnoreCase) || !string.IsNullOrEmpty(HostedDomain));
}

public interface IGoogleTokenValidator
{
    // Null se o comprovante for inválido (assinatura, destinatário, emissor ou prazo).
    Task<GoogleIdentity?> ValidateAsync(string credential);
}

// Configuração do login com o Google (seção "Google" do appsettings.json). O ClientId é público
// (vai também no frontend); a chave secreta do cliente não é usada por este fluxo e nunca entra aqui.
public class GoogleOptions
{
    public const string SectionName = "Google";

    public string? ClientId { get; set; }

    public bool Enabled => !string.IsNullOrWhiteSpace(ClientId);
}

// Confere o ID token com a biblioteca oficial do Google: assinatura com as chaves públicas do
// Google, destinatário (o ClientId do Kliny), emissor (accounts.google.com) e prazo.
public class GoogleTokenValidator(IOptions<GoogleOptions> options) : IGoogleTokenValidator
{
    public async Task<GoogleIdentity?> ValidateAsync(string credential)
    {
        if (!options.Value.Enabled)
            return null;
        try
        {
            var payload = await GoogleJsonWebSignature.ValidateAsync(credential,
                new GoogleJsonWebSignature.ValidationSettings { Audience = [options.Value.ClientId!] });
            if (string.IsNullOrEmpty(payload.Subject) || string.IsNullOrEmpty(payload.Email))
                return null;
            return new GoogleIdentity(payload.Subject, payload.Email, payload.EmailVerified, payload.HostedDomain, payload.Name);
        }
        // Comprovante malformado (vazio, Base64 ou JSON inválido) também é só um comprovante
        // inválido, e não um 500. Falha de rede ao buscar as chaves do Google continua sendo erro.
        catch (Exception ex) when (ex is InvalidJwtException or FormatException or ArgumentException or Newtonsoft.Json.JsonException)
        {
            return null;
        }
    }
}
