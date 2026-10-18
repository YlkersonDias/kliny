using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Vaults;

// O valor é sempre positivo: o endpoint define o sinal gravado.
public class VaultOperationRequest : IValidatableObject
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.AmountRequired))]
    public decimal? Amount { get; set; }

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DateRequired))]
    public DateOnly? Date { get; set; }

    [StringLength(255, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionMaxLength))]
    public string? Description { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Amount is { } amount)
        {
            if (amount <= 0)
                yield return new ValidationResult(Messages.AmountMustBePositive, [nameof(Amount)]);
            else if (AmountRules.Validate(amount) is { } error)
                yield return new ValidationResult(error, [nameof(Amount)]);
        }

        // Sem data futura. O servidor não conhece o fuso do usuário: "hoje" é o do fuso mais
        // adiantado (UTC+14), e o frontend aplica o limite exato.
        if (Date is { } date && date > DateOnly.FromDateTime(DateTime.UtcNow.AddHours(14)))
            yield return new ValidationResult(Messages.VaultOperationFutureDate, [nameof(Date)]);
    }
}
