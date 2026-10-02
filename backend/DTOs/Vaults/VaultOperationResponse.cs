using Backend.DTOs.Transactions;

namespace Backend.DTOs.Vaults;

public record VaultOperationResponse(TransactionResponse Transaction, decimal Balance);
