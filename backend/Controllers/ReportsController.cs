using Kliny.Api.DTOs.Reports;
using Kliny.Api.Extensions;
using Kliny.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kliny.Api.Controllers;

// Nos relatórios, gastos e depósitos em cofre vêm positivos.
[ApiController]
[Authorize]
[Route("api/reports")]
public class ReportsController(IReportService reportService) : ControllerBase
{
    [HttpGet("summary")]
    [ProducesResponseType<SummaryResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Summary([FromQuery] ReportPeriodQuery query) =>
        Ok(await reportService.GetSummaryAsync(User.GetUserId(), query));

    [HttpGet("by-category")]
    [ProducesResponseType<IReadOnlyList<CategoryTotalResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ByCategory([FromQuery] CategoryReportQuery query) =>
        Ok(await reportService.GetByCategoryAsync(User.GetUserId(), query));

    [HttpGet("timeline")]
    [ProducesResponseType<IReadOnlyList<TimelinePointResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Timeline([FromQuery] TimelineQuery query) =>
        Ok(await reportService.GetTimelineAsync(User.GetUserId(), query));
}
