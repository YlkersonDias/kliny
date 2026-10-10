using Backend.Data;
using Backend.DTOs.CategoryRules;
using Backend.Exceptions;
using Backend.Models;
using Backend.Resources;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public interface ICategoryRuleService
{
    Task<IReadOnlyList<CategoryRuleResponse>> ListAsync(int userId);

    /// <exception cref="BusinessRuleException">Categoria de outro usuário ou limite de regras.</exception>
    /// <exception cref="ConflictException">Já existe uma regra com esse texto.</exception>
    Task<CategoryRuleResponse> CreateAsync(int userId, CategoryRuleRequest request);

    /// <exception cref="NotFoundException">A regra não existe ou é de outro usuário.</exception>
    Task<CategoryRuleResponse> UpdateAsync(int userId, int id, CategoryRuleRequest request);

    /// <exception cref="NotFoundException">A regra não existe ou é de outro usuário.</exception>
    Task DeleteAsync(int userId, int id);

    /// <summary>Conta (preview) ou troca a categoria das movimentações cuja descrição contém o texto.</summary>
    /// <exception cref="NotFoundException">A regra não existe ou é de outro usuário.</exception>
    Task<CategoryRuleApplyResponse> ApplyAsync(int userId, int id, CategoryRuleApplyQuery query);
}

// Regras de categoria (8.4). Toda consulta filtra pelo usuário do token (regra 2), além do filtro
// global do AppDbContext.
public class CategoryRuleService(AppDbContext db) : ICategoryRuleService
{
    public const int MaxPerUser = 100;

    public async Task<IReadOnlyList<CategoryRuleResponse>> ListAsync(int userId) =>
        await Project(db.CategoryRules.AsNoTracking().Where(r => r.UserId == userId).OrderBy(r => r.Pattern).ThenBy(r => r.Id))
            .ToListAsync();

    public async Task<CategoryRuleResponse> CreateAsync(int userId, CategoryRuleRequest request)
    {
        await EnsureOwnCategoryAsync(userId, request.CategoryId!.Value);
        if (await db.CategoryRules.CountAsync(r => r.UserId == userId) >= MaxPerUser)
            throw new BusinessRuleException(string.Format(Messages.CategoryRuleLimitReached, MaxPerUser));

        var rule = new CategoryRule { UserId = userId, Pattern = request.Pattern.Trim(), CategoryId = request.CategoryId.Value };
        db.CategoryRules.Add(rule);
        await SaveAsync(userId, rule);
        return await GetAsync(userId, rule.Id);
    }

    public async Task<CategoryRuleResponse> UpdateAsync(int userId, int id, CategoryRuleRequest request)
    {
        var rule = await FindOwnedAsync(userId, id);
        await EnsureOwnCategoryAsync(userId, request.CategoryId!.Value);
        rule.Pattern = request.Pattern.Trim();
        rule.CategoryId = request.CategoryId.Value;
        await SaveAsync(userId, rule);
        return await GetAsync(userId, rule.Id);
    }

    public async Task DeleteAsync(int userId, int id)
    {
        var deleted = await db.CategoryRules.Where(r => r.Id == id && r.UserId == userId).ExecuteDeleteAsync();
        if (deleted == 0)
            throw new NotFoundException(Messages.CategoryRuleNotFound);
    }

    public async Task<CategoryRuleApplyResponse> ApplyAsync(int userId, int id, CategoryRuleApplyQuery query)
    {
        var rule = await db.CategoryRules.AsNoTracking()
            .Where(r => r.Id == id && r.UserId == userId)
            .Select(r => new { r.Pattern, r.CategoryId })
            .FirstOrDefaultAsync()
            ?? throw new NotFoundException(Messages.CategoryRuleNotFound);

        // Mesma busca do extrato (8.1): LIKE parametrizado pelo EF, sem diferenciar maiúsculas nem
        // acentos pela collation do banco. Operações de cofre ficam de fora: não têm categoria.
        var matching = db.Transactions.Where(t => t.UserId == userId && t.VaultId == null && t.Description.Contains(rule.Pattern));
        matching = query.IncludeCategorized
            ? matching.Where(t => t.CategoryId == null || t.CategoryId != rule.CategoryId)
            : matching.Where(t => t.CategoryId == null);

        var count = query.Preview
            ? await matching.CountAsync()
            : await matching.ExecuteUpdateAsync(setters => setters.SetProperty(t => t.CategoryId, rule.CategoryId));
        return new CategoryRuleApplyResponse(count);
    }

    private async Task<CategoryRuleResponse> GetAsync(int userId, int id) =>
        await Project(db.CategoryRules.AsNoTracking().Where(r => r.Id == id && r.UserId == userId)).FirstOrDefaultAsync()
            ?? throw new NotFoundException(Messages.CategoryRuleNotFound);

    private async Task<CategoryRule> FindOwnedAsync(int userId, int id) =>
        await db.CategoryRules.FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId)
            ?? throw new NotFoundException(Messages.CategoryRuleNotFound);

    // As chaves estrangeiras não garantem que a categoria seja do mesmo usuário.
    private async Task EnsureOwnCategoryAsync(int userId, int categoryId)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == categoryId && c.UserId == userId))
            throw new BusinessRuleException(Messages.CategoryNotFound);
    }

    private async Task SaveAsync(int userId, CategoryRule rule)
    {
        // A comparação usa a collation do banco, a mesma do índice único.
        if (await db.CategoryRules.AnyAsync(r => r.UserId == userId && r.Pattern == rule.Pattern && r.Id != rule.Id))
            throw new ConflictException(Messages.CategoryRulePatternInUse);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            throw new ConflictException(Messages.CategoryRulePatternInUse);
        }
    }

    private static IQueryable<CategoryRuleResponse> Project(IQueryable<CategoryRule> rules) =>
        rules.Select(r => new CategoryRuleResponse(r.Id, r.Pattern, r.CategoryId, r.Category.Name));
}
