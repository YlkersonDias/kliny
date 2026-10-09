using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.Auth;

// O comprovante (ID token) que o botão do Google entrega à página. É um JWT de alguns KB.
public class GoogleCredentialRequest
{
    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.GoogleCredentialRequired))]
    [StringLength(8192, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.GoogleCredentialRequired))]
    public string Credential { get; set; } = string.Empty;
}
