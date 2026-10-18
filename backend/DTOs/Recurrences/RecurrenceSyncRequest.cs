using System.ComponentModel.DataAnnotations;
using Kliny.Api.Resources;

namespace Kliny.Api.DTOs.Recurrences;

// O servidor não sabe o fuso: aceita só a um dia da data UTC (os fusos vão de UTC-12 a UTC+14).
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
