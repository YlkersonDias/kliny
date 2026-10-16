using Backend.Extensions;
using Backend.RateLimiting;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Backend.Controllers;

// Dados da própria conta. O usuário vem sempre do token.
[ApiController]
[Authorize]
[Route("api/account")]
public class AccountController(IExportService exportService) : ControllerBase
{
    // Exportação (LGPD, portabilidade): um .zip com o JSON completo e o CSV das movimentações.
    // Sai com o Cache-Control: no-store de todas as respostas da API (S.4).
    [HttpGet("export")]
    [EnableRateLimiting(RateLimitingSetup.ExportPolicy)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Export()
    {
        var content = await exportService.BuildAsync(User.GetUserId());
        // O nome usa a data UTC (o servidor não sabe o fuso); o frontend salva com a data local.
        return File(content, "application/zip", $"kliny-dados-{DateTime.UtcNow:yyyy-MM-dd}.zip");
    }
}
