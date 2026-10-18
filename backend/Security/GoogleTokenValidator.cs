using Google.Apis.Auth;
using Microsoft.Extensions.Options;

namespace Kliny.Api.Security;

// Subject ("sub") é o identificador fixo da conta Google: o Google pede para usá-lo, e não o e-mail.
public record GoogleIdentity(string Subject, string Email, bool EmailVerified, string? HostedDomain, string? Name)
{
    // O Google só é autoridade sobre o e-mail de contas @gmail.com e do Workspace com e-mail verificado.
    public bool IsEmailAuthoritative =>
        EmailVerified
        && (Email.Trim().EndsWith("@gmail.com", StringComparison.OrdinalIgnoreCase) || !string.IsNullOrEmpty(HostedDomain));
}

public interface IGoogleTokenValidator
{
    Task<GoogleIdentity?> ValidateAsync(string credential);
}

// O ClientId é público; a chave secreta do cliente não é usada por este fluxo.
public class GoogleOptions
{
    public const string SectionName = "Google";

    public string? ClientId { get; set; }

    public bool Enabled => !string.IsNullOrWhiteSpace(ClientId);
}

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
        // Comprovante malformado é só inválido, e não um 500.
        catch (Exception ex) when (ex is InvalidJwtException or FormatException or ArgumentException or Newtonsoft.Json.JsonException)
        {
            return null;
        }
    }
}
