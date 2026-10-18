using Kliny.Api.DTOs.Installments;
using Kliny.Api.Extensions;
using Kliny.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Kliny.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/installments")]
public class InstallmentsController(IInstallmentService installmentService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<InstallmentResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> List([FromQuery] InstallmentQuery query) =>
        Ok(await installmentService.ListAsync(User.GetUserId(), query.Today!.Value));

    [HttpPost]
    [ProducesResponseType<InstallmentResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(InstallmentCreateRequest request, [FromQuery] InstallmentQuery query)
    {
        var plan = await installmentService.CreateAsync(User.GetUserId(), request, query.Today!.Value);
        return StatusCode(StatusCodes.Status201Created, plan);
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id, [FromQuery] InstallmentDeleteQuery query)
    {
        await installmentService.DeleteAsync(User.GetUserId(), id, query.Scope!, query.Today!.Value);
        return NoContent();
    }
}
