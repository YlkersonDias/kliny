using System.ComponentModel.DataAnnotations;

namespace Backend.DTOs.Auth;

public class LoginRequest
{
    [Required(ErrorMessage = "Informe o e-mail.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Informe a senha.")]
    public string Password { get; set; } = string.Empty;
}
