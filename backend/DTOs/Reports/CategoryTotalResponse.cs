namespace Backend.DTOs.Reports;

// CategoryId nulo = sem categoria (o texto fica no frontend). Total é sempre positivo.
public record CategoryTotalResponse(int? CategoryId, string? CategoryName, decimal Total, int Count, decimal Percentage);
