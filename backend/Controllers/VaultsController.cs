using Backend.DTOs.Vaults;
using Backend.Extensions;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

[ApiController]
[Authorize]
[Route("api/vaults")]
public class VaultsController(IVaultService vaultService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<VaultResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List() =>
        Ok(await vaultService.ListAsync(User.GetUserId()));

    [HttpGet("{id:int}")]
    [ProducesResponseType<VaultResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(int id) =>
        Ok(await vaultService.GetAsync(User.GetUserId(), id));

    [HttpPost]
    [ProducesResponseType<VaultResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(VaultRequest request)
    {
        var vault = await vaultService.CreateAsync(User.GetUserId(), request);
        return CreatedAtAction(nameof(Get), new { id = vault.Id }, vault);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType<VaultResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(int id, VaultRequest request) =>
        Ok(await vaultService.UpdateAsync(User.GetUserId(), id, request));

    // Irreversível: apaga também as movimentações do cofre.
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(int id)
    {
        await vaultService.DeleteAsync(User.GetUserId(), id);
        return NoContent();
    }

    [HttpPost("{id:int}/deposit")]
    [ProducesResponseType<VaultOperationResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Deposit(int id, VaultOperationRequest request) =>
        Ok(await vaultService.DepositAsync(User.GetUserId(), id, request));

    [HttpPost("{id:int}/withdraw")]
    [ProducesResponseType<VaultOperationResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Withdraw(int id, VaultOperationRequest request) =>
        Ok(await vaultService.WithdrawAsync(User.GetUserId(), id, request));
}
