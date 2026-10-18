using System.ComponentModel.DataAnnotations;
using Kliny.Api.Resources;

namespace Kliny.Api.DTOs.Reports;

// Obrigatório: o fuso do servidor pode não ser o do usuário, então o frontend envia as datas.
public class ReportPeriodQuery : IValidatableObject
{
    public const int MaxYears = 10;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.FromRequired))]
    public DateOnly? From { get; set; }

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.ToRequired))]
    public DateOnly? To { get; set; }

    public virtual IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (From is not { } from || To is not { } to)
            yield break;

        if (from > to)
            yield return new ValidationResult(Messages.FromAfterTo, [nameof(From), nameof(To)]);
        // Nos últimos 10 anos do calendário, AddYears estouraria e nenhum "to" passa do limite.
        else if (from.Year <= DateOnly.MaxValue.Year - MaxYears && to > from.AddYears(MaxYears))
            yield return new ValidationResult(string.Format(Messages.PeriodMaxYears, MaxYears), [nameof(From), nameof(To)]);
    }
}
