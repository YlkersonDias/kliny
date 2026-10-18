using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Imports;

// Uma linha do extrato, já lida pelo navegador: o arquivo nunca chega à API.
public class ImportLine : IValidatableObject
{
    public const int SourceMaxLength = 40;
    public const int ExternalIdMaxLength = 255;

    // Banco e só os 4 últimos dígitos da conta ("341:4321"): identifica a conta sem guardá-la.
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.ImportLineInvalid))]
    [StringLength(SourceMaxLength, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.ImportLineInvalid))]
    public string Source { get; set; } = string.Empty;

    [StringLength(ExternalIdMaxLength, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.ImportLineInvalid))]
    public string? ExternalId { get; set; }

    // Posição entre as linhas com a mesma chave: duas compras iguais no mesmo dia são duas linhas.
    [Range(1, ImportRequest.MaxLines, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.ImportLineInvalid))]
    public int Occurrence { get; set; } = 1;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionRequired))]
    [StringLength(255, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionMaxLength))]
    public string Description { get; set; } = string.Empty;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.AmountRequired))]
    public decimal? Amount { get; set; }

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DateRequired))]
    public DateOnly? Date { get; set; }

    public int? CategoryId { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (string.IsNullOrWhiteSpace(Description))
            yield return new ValidationResult(Messages.DescriptionRequired, [nameof(Description)]);
        if (string.IsNullOrWhiteSpace(Source) || (ExternalId is not null && string.IsNullOrWhiteSpace(ExternalId)))
            yield return new ValidationResult(Messages.ImportLineInvalid, [nameof(Source)]);

        if (Amount is { } amount)
        {
            if (amount == 0)
                yield return new ValidationResult(Messages.AmountZero, [nameof(Amount)]);
            else if (AmountRules.Validate(amount) is { } error)
                yield return new ValidationResult(error, [nameof(Amount)]);
        }

        if (Date is { } date)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (date < ImportRequest.MinDate || date > today.AddYears(1))
                yield return new ValidationResult(Messages.ImportDateOutOfRange, [nameof(Date)]);
        }
    }
}

public class ImportRequest : IValidatableObject
{
    public const int MaxLines = 1000;
    public static readonly DateOnly MinDate = new(2000, 1, 1);

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.ImportLinesRequired))]
    public List<ImportLine>? Lines { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Lines is null)
            yield break;
        if (Lines.Count == 0 || Lines.Any(l => l is null))
            yield return new ValidationResult(Messages.ImportLinesRequired, [nameof(Lines)]);
        else if (Lines.Count > MaxLines)
            yield return new ValidationResult(string.Format(Messages.ImportTooManyLines, MaxLines), [nameof(Lines)]);
    }
}

// "similar": há um lançamento com a mesma data e o mesmo valor.
public static class ImportLineStatus
{
    public const string New = "new";
    public const string Imported = "imported";
    public const string Similar = "similar";
}

public record ImportCheckResponse(IReadOnlyList<string> Statuses);

public record ImportResponse(int Created, int Skipped);
