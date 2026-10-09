using Backend.DTOs.Recurrences;
using Backend.Extensions;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

// Lançamentos recorrentes (8.5a). O usuário vem sempre do token.
[ApiController]
[Authorize]
[Route("api/recurrences")]
public class RecurrencesController(IRecurrenceService recurrenceService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<RecurrenceResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List() =>
        Ok(await recurrenceService.ListAsync(User.GetUserId()));

    [HttpPost]
    [ProducesResponseType<RecurrenceResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(RecurrenceCreateRequest request)
    {
        var recurrence = await recurrenceService.CreateAsync(User.GetUserId(), request);
        return StatusCode(StatusCodes.Status201Created, recurrence);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType<RecurrenceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(int id, RecurrenceUpdateRequest request) =>
        Ok(await recurrenceService.UpdateAsync(User.GetUserId(), id, request));

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id)
    {
        await recurrenceService.DeleteAsync(User.GetUserId(), id);
        return NoContent();
    }

    // Chamado pelo app ao abrir e depois de criar ou mudar uma recorrência.
    [HttpPost("sync")]
    [ProducesResponseType<RecurrenceSyncResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Sync(RecurrenceSyncRequest request) =>
        Ok(await recurrenceService.SyncAsync(User.GetUserId(), request.Today!.Value));
}
