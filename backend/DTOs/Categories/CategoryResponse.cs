using Backend.Models;

namespace Backend.DTOs.Categories;

public record CategoryResponse(int Id, string Name, string? Color, string? Icon)
{
    public static CategoryResponse FromCategory(Category category) => new(category.Id, category.Name, category.Color, category.Icon);
}
