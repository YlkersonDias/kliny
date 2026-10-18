namespace Kliny.Api.Services;

// Sem banco, para testar os casos de calendário.
public static class RecurrenceSchedule
{
    // Num mês mais curto, o último dia dele.
    public static DateOnly InMonth(DateOnly month, int dayOfMonth)
    {
        var days = DateTime.DaysInMonth(month.Year, month.Month);
        return new DateOnly(month.Year, month.Month, Math.Min(dayOfMonth, days));
    }

    public static DateOnly Next(DateOnly date, int dayOfMonth) =>
        InMonth(new DateOnly(date.Year, date.Month, 1).AddMonths(1), dayOfMonth);

    public static DateOnly EndOfMonth(DateOnly date) =>
        new DateOnly(date.Year, date.Month, 1).AddMonths(1).AddDays(-1);
}
