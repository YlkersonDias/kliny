using System.Text.RegularExpressions;

namespace Backend.Data;

// Cabeçalho Idempotency-Key do depósito e da retirada (regra 18 de "Segurança (obrigatória)").
// O frontend manda um UUID por intenção de operação; o formato aceito é mais largo, mas fechado.
public static partial class IdempotencyKey
{
    public const string Header = "Idempotency-Key";
    public const int MaxLength = 64;

    public static bool IsValid(string key) => Format().IsMatch(key);

    [GeneratedRegex("^[A-Za-z0-9_-]{1,64}$")]
    private static partial Regex Format();
}
