namespace Backend.DTOs.Reports;

// Convenção dos relatórios: Expense e VaultDeposits vêm POSITIVOS, ao contrário do banco,
// onde gasto e depósito em cofre são negativos.
public record SummaryResponse(
    DateOnly From,
    DateOnly To,
    // Movimento do período, sem operações de cofre.
    decimal Income,
    decimal Expense,
    decimal Net,
    // Operações de cofre do período.
    decimal VaultDeposits,
    decimal VaultWithdrawals,
    // Posição no dia To, somando tudo desde o primeiro lançamento.
    decimal AccountBalance,
    decimal VaultsBalance);
