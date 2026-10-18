using System.ComponentModel.DataAnnotations;

namespace Kliny.Api.DTOs.Budgets;

public class BudgetRequest : IValidatableObject
{
    public decimal Amount { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Amount <= 0)
            yield return new ValidationResult(Resources.Messages.BudgetMustBePositive, [nameof(Amount)]);
        else if (AmountRules.Validate(Amount) is { } error)
            yield return new ValidationResult(error, [nameof(Amount)]);
    }
}
