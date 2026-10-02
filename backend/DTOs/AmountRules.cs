namespace Backend.DTOs;

// Regras de formato comuns a todo valor em dinheiro gravado em decimal(18,2).
// O sinal (zero, positivo, negativo) fica a cargo de cada DTO.
public static class AmountRules
{
    // Maior valor absoluto que cabe em decimal(18,2).
    public const decimal MaxAbsolute = 9_999_999_999_999_999.99m;

    /// <returns>A mensagem de erro, ou null se o valor for válido.</returns>
    public static string? Validate(decimal amount)
    {
        if (decimal.Round(amount, 2) != amount)
            return "O valor deve ter no máximo duas casas decimais.";
        if (Math.Abs(amount) > MaxAbsolute)
            return "O valor é grande demais.";
        return null;
    }
}
