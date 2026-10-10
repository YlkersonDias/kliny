using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Imports;

// Uma linha do extrato, já lida pelo navegador (o arquivo nunca chega à API). O servidor monta
// a chave de importação a partir de Source, ExternalId, Date, Amount, Occurrence e, sem
// ExternalId, da Description (ver ImportService.Key).
public class ImportLine : IValidatableObject
{
    public const int SourceMaxLength = 40;
    public const int ExternalIdMaxLength = 255;

    // Identifica a conta do arquivo sem guardá-la: banco e só os 4 últimos dígitos ("341:4321").
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.ImportLineInvalid))]
    [StringLength(SourceMaxLength, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.ImportLineInvalid))]
    public string Source { get; set; } = string.Empty;

    // O FITID do OFX (identificador da transação no banco), quando existe.
    [StringLength(ExternalIdMaxLength, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.ImportLineInvalid))]
    public string? ExternalId { get; set; }

    // A posição entre as linhas do arquivo com a mesma chave (1 na primeira), contada sobre o
    // arquivo inteiro, para duas compras iguais no mesmo dia serem duas linhas.
    [Range(1, ImportRequest.MaxLines, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.ImportLineInvalid))]
    public int Occurrence { get; set; } = 1;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionRequired))]
    [StringLength(255, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DescriptionMaxLength))]
    public string Description { get; set; } = string.Empty;

    // Com o sinal do banco: positivo = receita; negativo = gasto.
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.AmountRequired))]
    public decimal? Amount { get; set; }

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.DateRequired))]
    public DateOnly? Date { get; set; }

    // Só na importação; a conferência ignora.
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

        // Extrato é passado; aceita até um ano à frente (lançamento agendado) e nada antes de 2000.
        if (Date is { } date)
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (date < ImportRequest.MinDate || date > today.AddYears(1))
                yield return new ValidationResult(Messages.ImportDateOutOfRange, [nameof(Date)]);
        }
    }
}

// A conferência (check) e a importação recebem o mesmo formato: de 1 a 1.000 linhas.
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

// Situação de cada linha na conferência, na mesma ordem do pedido:
// "new", "imported" (a mesma linha já foi importada) ou "similar" (há um lançamento com a mesma data e valor).
public static class ImportLineStatus
{
    public const string New = "new";
    public const string Imported = "imported";
    public const string Similar = "similar";
}

public record ImportCheckResponse(IReadOnlyList<string> Statuses);

// Created: linhas gravadas. Skipped: as que já tinham sido importadas (outra aba, por exemplo).
public record ImportResponse(int Created, int Skipped);
