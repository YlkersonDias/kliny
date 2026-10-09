using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Recurrences;

// A data de hoje no navegador de quem usa: o servidor não sabe o fuso. Só é aceita a um dia, no
// máximo, da data UTC (os fusos vão de UTC-12 a UTC+14).
public class RecurrenceSyncRequest : IValidatableObject
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DateRequired))]
    public DateOnly? Today { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Today is not { } today)
            yield break;

        var utcToday = DateOnly.FromDateTime(DateTime.UtcNow);
        if (today < utcToday.AddDays(-1) || today > utcToday.AddDays(1))
            yield return new ValidationResult(Messages.TodayInvalid, [nameof(Today)]);
    }
}
