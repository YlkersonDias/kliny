using Backend.Data;
using Backend.DTOs.Categories;
using Backend.Exceptions;
using Backend.Models;
using Backend.Resources;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class CategoryService(AppDbContext db) : ICategoryService
{
    public async Task<IReadOnlyList<CategoryResponse>> ListAsync(int userId) =>
        await db.Categories
            .AsNoTracking()
            .Where(c => c.UserId == userId)
            .OrderBy(c => c.Name)
            .Select(c => new CategoryResponse(c.Id, c.Name, c.Color, c.Icon))
            .ToListAsync();

    public async Task<CategoryResponse> GetAsync(int userId, int id) =>
        CategoryResponse.FromCategory(await FindOwnedAsync(userId, id));

    public async Task<CategoryResponse> CreateAsync(int userId, CategoryRequest request)
    {
        var category = new Category { UserId = userId, Name = request.Name.Trim(), Color = request.Color, Icon = request.Icon };
        db.Categories.Add(category);
        await SaveAsync(userId, category);
        return CategoryResponse.FromCategory(category);
    }

    public async Task<CategoryResponse> UpdateAsync(int userId, int id, CategoryRequest request)
    {
        var category = await FindOwnedAsync(userId, id);
        category.Name = request.Name.Trim();
        category.Color = request.Color;
        category.Icon = request.Icon;
        await SaveAsync(userId, category);
        return CategoryResponse.FromCategory(category);
    }

    public async Task DeleteAsync(int userId, int id)
    {
        var category = await FindOwnedAsync(userId, id);
        db.Categories.Remove(category);
        await db.SaveChangesAsync();
    }

    private async Task<Category> FindOwnedAsync(int userId, int id) =>
        await db.Categories.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId)
            ?? throw new NotFoundException(Messages.CategoryNotFound);

    private async Task SaveAsync(int userId, Category category)
    {
        // A comparação usa a collation do banco, a mesma do índice único.
        if (await db.Categories.AnyAsync(c => c.UserId == userId && c.Name == category.Name && c.Id != category.Id))
            throw new ConflictException(Messages.CategoryDuplicateName);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            throw new ConflictException(Messages.CategoryDuplicateName);
        }
    }
}
