using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Categories;

public class CategoryRequest
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.CategoryNameRequired))]
    [StringLength(100, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.CategoryNameMaxLength))]
    public string Name { get; set; } = string.Empty;
}
