using Kliny.Api.DTOs.Imports;
using Kliny.Api.Extensions;
using Kliny.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kliny.Api.Controllers;

// O corpo pode chegar a 1 MB (1.000 linhas), acima dos 64 kB dos outros endereços no nginx.
[ApiController]
[Authorize]
[Route("api/imports")]
[RequestSizeLimit(MaxBodyBytes)]
public class ImportsController(IImportService importService) : ControllerBase
{
    public const int MaxBodyBytes = 1024 * 1024;

    [HttpPost("check")]
    [ProducesResponseType<ImportCheckResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Check(ImportRequest request) =>
        Ok(await importService.CheckAsync(User.GetUserId(), request.Lines!));

    [HttpPost]
    [ProducesResponseType<ImportResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Import(ImportRequest request) =>
        Ok(await importService.ImportAsync(User.GetUserId(), request.Lines!));
}
