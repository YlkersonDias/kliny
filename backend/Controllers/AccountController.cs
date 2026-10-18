using Kliny.Api.Extensions;
using Kliny.Api.RateLimiting;
using Kliny.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Kliny.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/account")]
public class AccountController(IExportService exportService) : ControllerBase
{
    [HttpGet("export")]
    [EnableRateLimiting(RateLimitingSetup.ExportPolicy)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Export()
    {
        var content = await exportService.BuildAsync(User.GetUserId());
        // O servidor não sabe o fuso: o frontend salva com a data local.
        return File(content, "application/zip", $"kliny-dados-{DateTime.UtcNow:yyyy-MM-dd}.zip");
    }
}
