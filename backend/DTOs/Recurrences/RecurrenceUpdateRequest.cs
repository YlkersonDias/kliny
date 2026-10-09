using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Recurrences;

// Alteração de uma recorrência (8.5a). Vale só para as próximas ocorrências; as já geradas ficam
// como estão. O dia e a data de início não mudam: para isso, apagar e criar outra.
public class RecurrenceUpdateRequest : IValidatableObject
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionRequired))]
    [StringLength(255, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionMaxLength))]
    public string Description { get; set; } = string.Empty;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.AmountRequired))]
    public decimal? Amount { get; set; }

    public DateOnly? EndDate { get; set; }

    public int? CategoryId { get; set; }

    public bool Paused { get; set; }

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
