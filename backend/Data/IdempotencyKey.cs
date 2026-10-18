using System.Text.RegularExpressions;

namespace Kliny.Api.Data;

// O frontend manda um UUID por intenção de operação; o formato aceito é mais largo, mas fechado.
public static partial class IdempotencyKey
{
    public const string Header = "Idempotency-Key";
    public const int MaxLength = 64;

    public static bool IsValid(string key) => Format().IsMatch(key);

    [GeneratedRegex("^[A-Za-z0-9_-]{1,64}$")]
    private static partial Regex Format();
}
