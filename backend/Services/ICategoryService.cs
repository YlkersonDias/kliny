using Kliny.Api.DTOs.Categories;

namespace Kliny.Api.Services;

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryResponse>> ListAsync(int userId);

    /// <exception cref="Exceptions.NotFoundException">A categoria não existe ou é de outro usuário.</exception>
    Task<CategoryResponse> GetAsync(int userId, int id);

    /// <exception cref="Exceptions.ConflictException">O usuário já tem uma categoria com esse nome.</exception>
    Task<CategoryResponse> CreateAsync(int userId, CategoryRequest request);

    /// <exception cref="Exceptions.NotFoundException">A categoria não existe ou é de outro usuário.</exception>
    /// <exception cref="Exceptions.ConflictException">O usuário já tem outra categoria com esse nome.</exception>
    Task<CategoryResponse> UpdateAsync(int userId, int id, CategoryRequest request);

    /// <summary>Apaga a categoria; as transações dela ficam sem categoria.</summary>
    /// <exception cref="Exceptions.NotFoundException">A categoria não existe ou é de outro usuário.</exception>
    Task DeleteAsync(int userId, int id);
}
