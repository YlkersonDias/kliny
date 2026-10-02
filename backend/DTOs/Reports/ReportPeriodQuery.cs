using System.ComponentModel.DataAnnotations;

namespace Backend.DTOs.Reports;

// Período obrigatório: o servidor não decide que dia é "hoje", porque o fuso dele
// pode não ser o do usuário. O frontend calcula o período e envia as datas.
public class ReportPeriodQuery : IValidatableObject
{
    public const int MaxYears = 10;

    [Required(ErrorMessage = "Informe a data inicial.")]
    public DateOnly? From { get; set; }

    [Required(ErrorMessage = "Informe a data final.")]
    public DateOnly? To { get; set; }

    public virtual IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (From is not { } from || To is not { } to)
            yield break;

        if (from > to)
            yield return new ValidationResult("A data inicial não pode ser depois da data final.", [nameof(From), nameof(To)]);
        // Nos últimos 10 anos do calendário, AddYears estouraria e nenhum "to" passa do limite.
        else if (from.Year <= DateOnly.MaxValue.Year - MaxYears && to > from.AddYears(MaxYears))
            yield return new ValidationResult($"O período deve ter no máximo {MaxYears} anos.", [nameof(From), nameof(To)]);
    }
}
