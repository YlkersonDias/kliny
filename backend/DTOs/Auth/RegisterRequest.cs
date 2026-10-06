using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Auth;

public class RegisterRequest
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.NameRequired))]
    [StringLength(100, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.NameMaxLength))]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.EmailRequired))]
    [EmailAddress(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.EmailInvalid))]
    [StringLength(255, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.EmailMaxLength))]
    public string Email { get; set; } = string.Empty;

    // O BCrypt considera só os primeiros 72 bytes da senha.
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.PasswordRequired))]
    [StringLength(72, MinimumLength = 8, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.PasswordLength))]
    public string Password { get; set; } = string.Empty;
}
