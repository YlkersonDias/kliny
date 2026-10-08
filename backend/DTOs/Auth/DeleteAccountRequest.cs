using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Auth;

// Excluir a própria conta exige a senha atual: um token roubado sozinho não apaga a conta.
public class DeleteAccountRequest
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.PasswordRequired))]
    [MaxUtf8Bytes(PasswordRules.MaxBytes, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.PasswordTooLong))]
    public string Password { get; set; } = string.Empty;
}
