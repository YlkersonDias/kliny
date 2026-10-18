using System.ComponentModel.DataAnnotations;
using Kliny.Api.Resources;

namespace Kliny.Api.DTOs.Installments;

// A data de hoje no navegador (o servidor não sabe o fuso), aceita só a um dia da data UTC.
public class InstallmentQuery : IValidatableObject
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DateRequired))]
    public DateOnly? Today { get; set; }

    public virtual IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Today is not { } today)
            yield break;

        var utcToday = DateOnly.FromDateTime(DateTime.UtcNow);
        if (today < utcToday.AddDays(-1) || today > utcToday.AddDays(1))
            yield return new ValidationResult(Messages.TodayInvalid, [nameof(Today)]);
    }
}

// Lista fechada.
public static class InstallmentDeleteScope
{
    public const string All = "all";
    public const string Future = "future";
}

public class InstallmentDeleteQuery : InstallmentQuery
{
    public string? Scope { get; set; }

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;
        if (Scope is not (InstallmentDeleteScope.All or InstallmentDeleteScope.Future))
            yield return new ValidationResult(Messages.InstallmentScopeInvalid, [nameof(Scope)]);
    }
}
