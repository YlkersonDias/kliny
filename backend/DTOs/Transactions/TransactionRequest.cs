using System.ComponentModel.DataAnnotations;

namespace Backend.DTOs.Transactions;

// Não tem VaultId: operações de cofre usam os endpoints de cofre.
public class TransactionRequest : IValidatableObject
{
    [Required(ErrorMessage = "Informe a descrição.")]
    [StringLength(255, ErrorMessage = "A descrição deve ter no máximo 255 caracteres.")]
    public string Description { get; set; } = string.Empty;

    // Positivo = receita; negativo = gasto.
    [Required(ErrorMessage = "Informe o valor.")]
    public decimal? Amount { get; set; }

    [Required(ErrorMessage = "Informe a data.")]
    public DateOnly? Date { get; set; }

    public int? CategoryId { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Amount is not { } amount)
            yield break;

        if (amount == 0)
            yield return new ValidationResult("O valor não pode ser zero.", [nameof(Amount)]);
        else if (AmountRules.Validate(amount) is { } error)
            yield return new ValidationResult(error, [nameof(Amount)]);
    }
}
