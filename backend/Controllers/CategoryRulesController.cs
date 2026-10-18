using Backend.DTOs.CategoryRules;
using Backend.Extensions;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Backend.Controllers;

[ApiController]
[Authorize]
[Route("api/category-rules")]
public class CategoryRulesController(ICategoryRuleService ruleService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<CategoryRuleResponse>>(StatusCodes.Status200OK)]
    public async Task<IActionResult> List() => Ok(await ruleService.ListAsync(User.GetUserId()));

    [HttpPost]
    [ProducesResponseType<CategoryRuleResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(CategoryRuleRequest request) =>
        StatusCode(StatusCodes.Status201Created, await ruleService.CreateAsync(User.GetUserId(), request));

    [HttpPut("{id:int}")]
    [ProducesResponseType<CategoryRuleResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(int id, CategoryRuleRequest request) =>
        Ok(await ruleService.UpdateAsync(User.GetUserId(), id, request));

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(int id)
    {
        await ruleService.DeleteAsync(User.GetUserId(), id);
        return NoContent();
    }

    [HttpPost("{id:int}/apply")]
    [ProducesResponseType<CategoryRuleApplyResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Apply(int id, [FromQuery] CategoryRuleApplyQuery query) =>
        Ok(await ruleService.ApplyAsync(User.GetUserId(), id, query));
}
