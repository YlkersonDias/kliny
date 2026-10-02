namespace Backend.DTOs.Reports;

// Period é o próprio dia, ou o primeiro dia do mês no agrupamento mensal.
// Expense vem positivo; Net = Income - Expense.
public record TimelinePointResponse(DateOnly Period, decimal Income, decimal Expense, decimal Net);
