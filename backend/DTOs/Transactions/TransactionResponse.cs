namespace Backend.DTOs.Transactions;

public record TransactionResponse(
    int Id,
    string Description,
    decimal Amount,
    DateOnly Date,
    int? CategoryId,
    string? CategoryName,
    int? VaultId,
    int? RecurrenceId);
