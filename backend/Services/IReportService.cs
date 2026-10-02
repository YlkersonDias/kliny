using Backend.DTOs.Reports;

namespace Backend.Services;

// Nos relatórios, gastos e depósitos em cofre vêm com valor positivo.
public interface IReportService
{
    Task<SummaryResponse> GetSummaryAsync(int userId, ReportPeriodQuery query);

    /// <summary>Totais por categoria no período, do maior para o menor, sem operações de cofre.</summary>
    Task<IReadOnlyList<CategoryTotalResponse>> GetByCategoryAsync(int userId, CategoryReportQuery query);

    /// <summary>Receitas e gastos por dia ou mês, com zero nos períodos sem movimento e sem operações de cofre.</summary>
    Task<IReadOnlyList<TimelinePointResponse>> GetTimelineAsync(int userId, TimelineQuery query);
}
