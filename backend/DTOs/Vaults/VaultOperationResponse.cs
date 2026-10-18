using Kliny.Api.DTOs.Transactions;

namespace Kliny.Api.DTOs.Vaults;

public record VaultOperationResponse(TransactionResponse Transaction, decimal Balance);

// Replayed não vai no corpo, só no cabeçalho Idempotent-Replayed.
public record VaultOperationResult(VaultOperationResponse Response, bool Replayed);
