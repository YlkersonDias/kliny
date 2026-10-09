namespace Backend.Services;

// As datas de uma recorrência mensal (8.5a). Sem banco, para testar os casos de calendário.
public static class RecurrenceSchedule
{
    // Ocorrência do mês de "month" no dia escolhido; num mês mais curto, o último dia dele.
    public static DateOnly InMonth(DateOnly month, int dayOfMonth)
    {
        var days = DateTime.DaysInMonth(month.Year, month.Month);
        return new DateOnly(month.Year, month.Month, Math.Min(dayOfMonth, days));
    }

    // A ocorrência seguinte a "date", no mês seguinte.
    public static DateOnly Next(DateOnly date, int dayOfMonth) =>
        InMonth(new DateOnly(date.Year, date.Month, 1).AddMonths(1), dayOfMonth);

    public static DateOnly EndOfMonth(DateOnly date) =>
        new DateOnly(date.Year, date.Month, 1).AddMonths(1).AddDays(-1);
}
