using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Auth;

// Excluir a própria conta exige provar de novo quem é: a senha atual, ou, em conta só do Google,
// um comprovante novo do Google da mesma conta. Um token roubado sozinho não apaga a conta.
// Qual dos dois vale depende da conta; quem decide é o AuthService.
public class DeleteAccountRequest
{
    [MaxUtf8Bytes(PasswordRules.MaxBytes, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.PasswordTooLong))]
    public string? Password { get; set; }

    [StringLength(8192, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.GoogleCredentialRequired))]
    public string? GoogleCredential { get; set; }
}
