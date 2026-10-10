using Backend.DTOs.Installments;
using Backend.Extensions;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

// Compras parceladas (8.5b). O usuário vem sempre do token; "today" vem do navegador.
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
