using Backend.Models;

namespace Backend.DTOs.Categories;

public record CategoryResponse(int Id, string Name)
{
    public static CategoryResponse FromCategory(Category category) => new(category.Id, category.Name);
}
