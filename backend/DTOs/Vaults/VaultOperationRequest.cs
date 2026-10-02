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
        if (Amount is not { } amount)
            yield break;

        if (amount <= 0)
            yield return new ValidationResult("O valor deve ser maior que zero.", [nameof(Amount)]);
        else if (AmountRules.Validate(amount) is { } error)
            yield return new ValidationResult(error, [nameof(Amount)]);
    }
}
