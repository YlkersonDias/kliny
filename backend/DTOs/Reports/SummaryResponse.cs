namespace Backend.DTOs.Reports;

// Expense e VaultDeposits vêm positivos, ao contrário do banco.
public record SummaryResponse(
    DateOnly From,
    DateOnly To,
    // Sem operações de cofre.
    decimal Income,
    decimal Expense,
    decimal Net,
    decimal VaultDeposits,
    decimal VaultWithdrawals,
    // No dia To, desde o primeiro lançamento.
    decimal AccountBalance,
    decimal VaultsBalance);
