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
}

// Fim do cadastro, pelo link do e-mail: a senha é escolhida aqui, por quem recebeu o link (e não
// no formulário de cadastro). De 8 a 72 caracteres e no máximo 72 bytes em UTF-8 (S.6): o BCrypt
// só usa os primeiros 72 bytes.
public class CompleteRegistrationRequest
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.RegistrationTokenInvalid))]
    [StringLength(100, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.RegistrationTokenInvalid))]
    public string Token { get; set; } = string.Empty;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.PasswordRequired))]
    [StringLength(72, MinimumLength = 8, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.PasswordLength))]
    [MaxUtf8Bytes(PasswordRules.MaxBytes, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.PasswordTooLong))]
    public string Password { get; set; } = string.Empty;
}
