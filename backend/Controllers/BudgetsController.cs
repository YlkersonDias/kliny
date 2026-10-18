using Backend.DTOs.Budgets;
using Backend.Extensions;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

[ApiController]
[Authorize]
[Route("api/budgets")]
public class BudgetsController(IBudgetService budgetService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<BudgetResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> List([FromQuery] BudgetQuery query) =>
        Ok(await budgetService.ListAsync(User.GetUserId(), query));

    [HttpPut("{categoryId:int}")]
    [ProducesResponseType<BudgetLimitResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Set(int categoryId, BudgetRequest request) =>
        Ok(await budgetService.SetAsync(User.GetUserId(), categoryId, request));

    [HttpDelete("{categoryId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int categoryId)
    {
        await budgetService.DeleteAsync(User.GetUserId(), categoryId);
        return NoContent();
    }
}
