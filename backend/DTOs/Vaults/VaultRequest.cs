using System.ComponentModel.DataAnnotations;

namespace Backend.DTOs.Vaults;

public class VaultRequest : IValidatableObject
{
    [Required(ErrorMessage = "Informe o nome do cofre.")]
    [StringLength(100, ErrorMessage = "O nome do cofre deve ter no máximo 100 caracteres.")]
    public string Name { get; set; } = string.Empty;

    // Meta opcional, em reais.
    public decimal? Goal { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Goal is not { } goal)
            yield break;

        if (goal <= 0)
            yield return new ValidationResult("A meta deve ser maior que zero.", [nameof(Goal)]);
        else if (AmountRules.Validate(goal) is { } error)
            yield return new ValidationResult(error, [nameof(Goal)]);
    }
}
