using System.ComponentModel.DataAnnotations;
using System.Globalization;
using Backend.Resources;

namespace Backend.DTOs.Budgets;

// Mês do gasto, no formato 2026-10. Obrigatório, como o período dos relatórios: o servidor não
// sabe o fuso de quem usa, então é o frontend que diz qual é o mês atual.
public class BudgetQuery : IValidatableObject
{
    public string? Month { get; set; }

    // Métodos, e não propriedades: a validação do ASP.NET lê todas as propriedades públicas, e estas
    // quebrariam (500) com um mês inválido antes de o Validate responder 400. Só chamar depois dele.
    public DateOnly FirstDay() => DateOnly.ParseExact(Month!, "yyyy-MM", CultureInfo.InvariantCulture);
    public DateOnly LastDay() => FirstDay().AddMonths(1).AddDays(-1);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        // Até 9998-12: o último dia de 9999-12 não cabe no cálculo de LastDay.
        if (Month is null
            || !DateOnly.TryParseExact(Month, "yyyy-MM", CultureInfo.InvariantCulture, DateTimeStyles.None, out var first)
            || first.Year > 9998)
            yield return new ValidationResult(Messages.MonthInvalid, [nameof(Month)]);
    }
}
