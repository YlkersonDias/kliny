using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Vaults;

public class VaultRequest : IValidatableObject
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.VaultNameRequired))]
    [StringLength(100, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.VaultNameMaxLength))]
    public string Name { get; set; } = string.Empty;

    // Meta opcional, em reais.
    public decimal? Goal { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Goal is not { } goal)
            yield break;

        if (goal <= 0)
            yield return new ValidationResult(Messages.GoalMustBePositive, [nameof(Goal)]);
        else if (AmountRules.Validate(goal) is { } error)
            yield return new ValidationResult(error, [nameof(Goal)]);
    }
}
