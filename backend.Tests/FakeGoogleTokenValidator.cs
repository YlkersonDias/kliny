using Backend.Security;

namespace Backend.Tests;

// O "comprovante" é um texto montado por Credential(...); qualquer outro texto é recusado.
public sealed class FakeGoogleTokenValidator : IGoogleTokenValidator
{
    private const string Prefix = "fake-google";

    public static string Credential(string subject, string email, bool emailVerified = true,
        string? hostedDomain = null, string? name = "Pessoa do Google") =>
        string.Join('|', Prefix, subject, email, emailVerified, hostedDomain ?? "", name ?? "");

    public Task<GoogleIdentity?> ValidateAsync(string credential)
    {
        var parts = credential.Split('|');
        if (parts.Length != 6 || parts[0] != Prefix)
            return Task.FromResult<GoogleIdentity?>(null);
        return Task.FromResult<GoogleIdentity?>(new GoogleIdentity(
            parts[1], parts[2], bool.Parse(parts[3]),
            parts[4] == "" ? null : parts[4],
            parts[5] == "" ? null : parts[5]));
    }
}
