using System.ComponentModel.DataAnnotations;

namespace Backend.DTOs.Auth;

public class RegisterRequest
{
    [Required(ErrorMessage = "Informe o nome.")]
    [StringLength(100, ErrorMessage = "O nome deve ter no máximo 100 caracteres.")]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Informe o e-mail.")]
    [EmailAddress(ErrorMessage = "E-mail inválido.")]
    [StringLength(255, ErrorMessage = "O e-mail deve ter no máximo 255 caracteres.")]
    public string Email { get; set; } = string.Empty;

    // O BCrypt considera só os primeiros 72 bytes da senha.
    [Required(ErrorMessage = "Informe a senha.")]
    [StringLength(72, MinimumLength = 8, ErrorMessage = "A senha deve ter entre 8 e 72 caracteres.")]
    public string Password { get; set; } = string.Empty;
}
