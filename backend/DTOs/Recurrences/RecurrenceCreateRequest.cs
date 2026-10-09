using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Recurrences;

// Nova recorrência mensal (8.5a). O dia de todos os meses é o da StartDate.
public class RecurrenceCreateRequest : IValidatableObject
{
    // A primeira ocorrência pode ser de até um ano atrás (o resto viria como um ano de lançamentos de
    // uma vez) e de até um ano à frente.
    public const int MaxStartDistanceDays = 366;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionRequired))]
    [StringLength(255, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionMaxLength))]
    public string Description { get; set; } = string.Empty;

    // Positivo = receita; negativo = gasto.
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.AmountRequired))]
    public decimal? Amount { get; set; }

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DateRequired))]
    public DateOnly? StartDate { get; set; }

    public DateOnly? EndDate { get; set; }

    public int? CategoryId { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Amount is { } amount)
        {
            if (amount == 0)
                yield return new ValidationResult(Messages.AmountZero, [nameof(Amount)]);
            else if (AmountRules.Validate(amount) is { } error)
                yield return new ValidationResult(error, [nameof(Amount)]);
        }

        if (StartDate is { } start)
        {
            // O servidor não sabe o fuso de quem usa: a distância é contada da data UTC, com um dia de folga.
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (start < today.AddDays(-MaxStartDistanceDays - 1) || start > today.AddDays(MaxStartDistanceDays + 1))
                yield return new ValidationResult(Messages.RecurrenceStartOutOfRange, [nameof(StartDate)]);
            else if (EndDate is { } end && end < start)
                yield return new ValidationResult(Messages.RecurrenceEndBeforeStart, [nameof(EndDate)]);
        }
    }
}
