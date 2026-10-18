using Backend.DTOs.Transactions;

namespace Backend.DTOs.Vaults;

public record VaultOperationResponse(TransactionResponse Transaction, decimal Balance);

// Replayed não vai no corpo, só no cabeçalho Idempotent-Replayed.
public record VaultOperationResult(VaultOperationResponse Response, bool Replayed);
