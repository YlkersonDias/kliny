namespace Backend.DTOs.Budgets;

// Spent: gastos do mês na categoria, positivo (como o expense dos relatórios), sem operações de cofre.
public record BudgetResponse(int CategoryId, string CategoryName, decimal Limit, decimal Spent);

public record BudgetLimitResponse(int CategoryId, decimal Limit);
