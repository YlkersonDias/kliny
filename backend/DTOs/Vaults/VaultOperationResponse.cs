using Backend.DTOs.Transactions;

namespace Backend.DTOs.Vaults;

public record VaultOperationResponse(TransactionResponse Transaction, decimal Balance);

// Resultado interno do service: Replayed indica um envio repetido (mesma Idempotency-Key), que
// devolve o lançamento já gravado. Não vai no corpo da resposta, só no cabeçalho Idempotent-Replayed.
public record VaultOperationResult(VaultOperationResponse Response, bool Replayed);
