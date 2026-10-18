namespace Backend.DTOs.Budgets;

// Spent vem positivo, como o expense dos relatórios.
public record BudgetResponse(int CategoryId, string CategoryName, decimal Limit, decimal Spent);

public record BudgetLimitResponse(int CategoryId, decimal Limit);
