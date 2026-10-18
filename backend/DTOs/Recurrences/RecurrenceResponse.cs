namespace Kliny.Api.DTOs.Recurrences;

// Amount com o sinal da movimentação. NextDate: a próxima ocorrência ainda não gerada.
public record RecurrenceResponse(
    int Id,
    string Description,
    decimal Amount,
    int? CategoryId,
    string? CategoryName,
    DateOnly StartDate,
    int DayOfMonth,
    DateOnly? EndDate,
    DateOnly NextDate,
    bool Paused);

public record RecurrenceSyncResponse(int Created);
