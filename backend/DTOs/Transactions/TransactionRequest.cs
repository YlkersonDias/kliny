using System.ComponentModel.DataAnnotations;
using Kliny.Api.Resources;

namespace Kliny.Api.DTOs.Transactions;

// Sem VaultId: operações de cofre usam os endpoints de cofre.
public class TransactionRequest : IValidatableObject
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionRequired))]
    [StringLength(255, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionMaxLength))]
    public string Description { get; set; } = string.Empty;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.AmountRequired))]
    public decimal? Amount { get; set; }

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DateRequired))]
    public DateOnly? Date { get; set; }

    public int? CategoryId { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Amount is not { } amount)
            yield break;

        if (amount == 0)
            yield return new ValidationResult(Messages.AmountZero, [nameof(Amount)]);
        else if (AmountRules.Validate(amount) is { } error)
            yield return new ValidationResult(error, [nameof(Amount)]);
    }
}
