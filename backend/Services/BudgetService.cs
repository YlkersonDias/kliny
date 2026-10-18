using Kliny.Api.Data;
using Kliny.Api.DTOs.Budgets;
using Kliny.Api.Exceptions;
using Kliny.Api.Models;
using Kliny.Api.Resources;
using Microsoft.EntityFrameworkCore;

namespace Kliny.Api.Services;

public class BudgetService(AppDbContext db) : IBudgetService
{
    public async Task<IReadOnlyList<BudgetResponse>> ListAsync(int userId, BudgetQuery query)
    {
        var budgets = await db.Budgets.AsNoTracking()
            .Where(b => b.UserId == userId)
            .Select(b => new { b.CategoryId, b.Category.Name, b.Amount })
            .ToListAsync();
        if (budgets.Count == 0)
            return [];

        // Só gastos, fora de cofre, como nos relatórios.
        var categoryIds = budgets.Select(b => b.CategoryId).ToList();
        var from = query.FirstDay();
        var to = query.LastDay();
        var spent = await db.Transactions.AsNoTracking()
            .Where(t => t.UserId == userId && t.VaultId == null && t.Amount < 0
                && t.Date >= from && t.Date <= to
                && t.CategoryId != null && categoryIds.Contains(t.CategoryId.Value))
            .GroupBy(t => t.CategoryId!.Value)
            .Select(g => new { CategoryId = g.Key, Total = -g.Sum(t => t.Amount) })
            .ToDictionaryAsync(g => g.CategoryId, g => g.Total);

        return budgets
            .Select(b => new BudgetResponse(b.CategoryId, b.Name, b.Amount, spent.GetValueOrDefault(b.CategoryId)))
            .OrderBy(b => b.CategoryName)
            .ToList();
    }

    public async Task<BudgetLimitResponse> SetAsync(int userId, int categoryId, BudgetRequest request)
    {
        // Categoria de outro usuário responde como inexistente.
        if (!await db.Categories.AnyAsync(c => c.Id == categoryId && c.UserId == userId))
            throw new NotFoundException(Messages.CategoryNotFound);

        var budget = await db.Budgets.FirstOrDefaultAsync(b => b.CategoryId == categoryId && b.UserId == userId);
        if (budget is null)
        {
            budget = new Budget { UserId = userId, CategoryId = categoryId, Amount = request.Amount };
            db.Budgets.Add(budget);
        }
        else
        {
            budget.Amount = request.Amount;
        }

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            // Outro pedido simultâneo criou primeiro: vale este valor.
            db.ChangeTracker.Clear();
            await db.Budgets
                .Where(b => b.CategoryId == categoryId && b.UserId == userId)
                .ExecuteUpdateAsync(setters => setters.SetProperty(b => b.Amount, request.Amount));
        }

        return new BudgetLimitResponse(categoryId, request.Amount);
    }

    public async Task DeleteAsync(int userId, int categoryId)
    {
        var deleted = await db.Budgets
            .Where(b => b.CategoryId == categoryId && b.UserId == userId)
            .ExecuteDeleteAsync();
        if (deleted == 0)
            throw new NotFoundException(Messages.BudgetNotFound);
    }
}
