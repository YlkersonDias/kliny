using System.ComponentModel.DataAnnotations;
using Kliny.Api.Resources;

namespace Kliny.Api.DTOs.Reports;

public enum TimelineGrouping
{
    Month,
    Day,
}

public class TimelineQuery : ReportPeriodQuery
{
    // Acima disso o gráfico diário fica ilegível e a resposta cresce demais.
    public const int MaxDays = 366;

    public TimelineGrouping GroupBy { get; set; } = TimelineGrouping.Month;

    public override IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        foreach (var result in base.Validate(validationContext))
            yield return result;

        if (GroupBy == TimelineGrouping.Day && From is { } from && To is { } to
            && to.DayNumber - from.DayNumber + 1 > MaxDays)
            yield return new ValidationResult(
                string.Format(Messages.TimelineDayMaxDays, MaxDays), [nameof(GroupBy)]);
    }
}
