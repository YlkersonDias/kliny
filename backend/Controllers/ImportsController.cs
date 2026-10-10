using Backend.DTOs.Imports;
using Backend.Extensions;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

// Importação de extrato (8.3). O usuário vem sempre do token. O corpo pode chegar a 1 MB
// (1.000 linhas), acima dos 64 kB que o nginx aceita nos outros endereços.
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
