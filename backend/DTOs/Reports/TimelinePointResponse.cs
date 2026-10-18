namespace Kliny.Api.DTOs.Reports;

// Period é o dia, ou o primeiro dia do mês. Expense vem positivo; Net = Income - Expense.
public record TimelinePointResponse(DateOnly Period, decimal Income, decimal Expense, decimal Net);
