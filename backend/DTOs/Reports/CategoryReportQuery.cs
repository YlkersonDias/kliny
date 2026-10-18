namespace Kliny.Api.DTOs.Reports;

public enum CategoryReportType
{
    Expense,
    Income,
}

public class CategoryReportQuery : ReportPeriodQuery
{
    public CategoryReportType Type { get; set; } = CategoryReportType.Expense;
}
