using System.ComponentModel.DataAnnotations;
using Kliny.Api.DTOs.Recurrences;
using Kliny.Api.Resources;

namespace Kliny.Api.DTOs.Installments;

// Sempre um gasto: o total vem positivo e as parcelas são gravadas negativas.
public class InstallmentCreateRequest : IValidatableObject
{
    public const int MinCount = 2;
    public const int MaxCount = 120;

    // 255 da movimentação menos o " (120/120)" que entra em cada parcela.
    public const int DescriptionMaxLength = 245;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionRequired))]
    [StringLength(DescriptionMaxLength, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.InstallmentDescriptionMaxLength))]
    public string Description { get; set; } = string.Empty;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.AmountRequired))]
    public decimal? Total { get; set; }

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.InstallmentCountRange))]
    public int? Count { get; set; }

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DateRequired))]
    public DateOnly? FirstDate { get; set; }

    public int? CategoryId { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Count is { } count && count is < MinCount or > MaxCount)
            yield return new ValidationResult(Messages.InstallmentCountRange, [nameof(Count)]);

        if (Total is { } total)
        {
            if (total <= 0)
                yield return new ValidationResult(Messages.InstallmentTotalPositive, [nameof(Total)]);
            else if (AmountRules.Validate(total) is { } error)
                yield return new ValidationResult(error, [nameof(Total)]);
            else if (Count is { } parts and >= MinCount and <= MaxCount && total * 100 < parts)
                yield return new ValidationResult(Messages.InstallmentTotalTooSmall, [nameof(Total)]);
        }

        // Mesma janela da primeira data de uma recorrência.
        if (FirstDate is { } first)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var days = RecurrenceCreateRequest.MaxStartDistanceDays;
            if (first < today.AddDays(-days - 1) || first > today.AddDays(days + 1))
                yield return new ValidationResult(Messages.RecurrenceStartOutOfRange, [nameof(FirstDate)]);
        }
    }
}
