using System.ComponentModel.DataAnnotations;

namespace Backend.DTOs.Categories;

public class CategoryRequest
{
    [Required(ErrorMessage = "Informe o nome da categoria.")]
    [StringLength(100, ErrorMessage = "O nome da categoria deve ter no máximo 100 caracteres.")]
    public string Name { get; set; } = string.Empty;
}
