namespace Backend.DTOs.Reports;

// CategoryId e CategoryName nulos = movimentações sem categoria; o texto exibido fica no frontend.
// Total é sempre positivo, também para gastos.
public record CategoryTotalResponse(int? CategoryId, string? CategoryName, decimal Total, int Count, decimal Percentage);
