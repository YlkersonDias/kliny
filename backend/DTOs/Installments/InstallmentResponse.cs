namespace Backend.DTOs.Installments;

// Total positivo. Remaining: parcelas ainda ligadas à compra com data depois de hoje.
public record InstallmentResponse(
    int Id,
    string Description,
    decimal Total,
    int Count,
    int? CategoryId,
    string? CategoryName,
    DateOnly FirstDate,
    DateOnly LastDate,
    int Remaining);
