using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Categories;

public class CategoryRequest : IValidatableObject
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.CategoryNameRequired))]
    [StringLength(100, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.CategoryNameMaxLength))]
    public string Name { get; set; } = string.Empty;

    // Opcionais: sem eles (ou nulos), a categoria fica com a cor neutra e a etiqueta. O PUT grava o
    // que vier, então quem edita manda os três campos.
    public string? Color { get; set; }
    public string? Icon { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Color is not null && !CategoryAppearance.Colors.Contains(Color))
            yield return new ValidationResult(Messages.CategoryColorInvalid, [nameof(Color)]);
        if (Icon is not null && !CategoryAppearance.Icons.Contains(Icon))
            yield return new ValidationResult(Messages.CategoryIconInvalid, [nameof(Icon)]);
    }
}
