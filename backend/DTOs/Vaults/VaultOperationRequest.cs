using System.ComponentModel.DataAnnotations;

namespace Backend.DTOs.Vaults;

// Usado no depósito e na retirada. O valor é sempre positivo: o endpoint define o sinal gravado.
public class VaultOperationRequest : IValidatableObject
{
    [Required(ErrorMessage = "Informe o valor.")]
    public decimal? Amount { get; set; }

    [Required(ErrorMessage = "Informe a data.")]
    public DateOnly? Date { get; set; }

    // Opcional; sem ela, o service usa "Depósito no cofre X" ou "Retirada do cofre X".
    [StringLength(255, ErrorMessage = "A descrição deve ter no máximo 255 caracteres.")]
    public string? Description { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Amount is { } amount)
        {
            if (amount <= 0)
                yield return new ValidationResult("O valor deve ser maior que zero.", [nameof(Amount)]);
            else if (AmountRules.Validate(amount) is { } error)
                yield return new ValidationResult(error, [nameof(Amount)]);
        }

        // Operação de cofre é dinheiro movido agora: sem data futura (data passada pode).
        // O servidor não conhece o fuso do usuário, então "hoje" é o do fuso mais adiantado
        // do mundo (UTC+14): ninguém tem a própria data de hoje recusada. O frontend aplica
        // o limite exato, com a data local do navegador.
        if (Date is { } date && date > DateOnly.FromDateTime(DateTime.UtcNow.AddHours(14)))
            yield return new ValidationResult("Operações de cofre não podem ter data futura.", [nameof(Date)]);
    }
}
