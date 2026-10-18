using System.ComponentModel.DataAnnotations;
using Kliny.Api.Resources;

namespace Kliny.Api.DTOs.Auth;

// A senha atual ou, em conta só do Google, um comprovante novo do Google: um token roubado sozinho
// não apaga a conta. O AuthService decide qual dos dois vale.
public class DeleteAccountRequest
{
    [MaxUtf8Bytes(PasswordRules.MaxBytes, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.PasswordTooLong))]
    public string? Password { get; set; }

    [StringLength(8192, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.GoogleCredentialRequired))]
    public string? GoogleCredential { get; set; }
}
