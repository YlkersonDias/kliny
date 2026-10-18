using Kliny.Api.Resources;

namespace Kliny.Api.DTOs;

// O sinal (zero, positivo, negativo) fica a cargo de cada DTO.
public static class AmountRules
{
    public const decimal MaxAbsolute = 9_999_999_999_999_999.99m;

    /// <returns>A mensagem de erro, ou null se o valor for válido.</returns>
    public static string? Validate(decimal amount)
    {
        if (decimal.Round(amount, 2) != amount)
            return Messages.AmountTooManyDecimals;
        if (Math.Abs(amount) > MaxAbsolute)
            return Messages.AmountTooLarge;
        return null;
    }
}
