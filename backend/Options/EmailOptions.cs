using System.ComponentModel.DataAnnotations;

namespace Backend.Options;

// Sem chave, nada é enviado: o desenvolvimento e os testes funcionam sem o serviço.
public class EmailOptions : IValidatableObject
{
    public const string SectionName = "Email";

    public string? ApiKey { get; set; }

    [Required]
    public string From { get; set; } = string.Empty;

    // Da configuração, nunca do cabeçalho Host: um Host forjado faria o link com o token apontar para outro site.
    [Required]
    public string AppUrl { get; set; } = string.Empty;

    [Required, EmailAddress]
    public string Support { get; set; } = string.Empty;

    public bool Enabled => !string.IsNullOrWhiteSpace(ApiKey);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        // https, ou http só em localhost.
        if (!Uri.TryCreate(AppUrl, UriKind.Absolute, out var uri)
            || !(uri.Scheme == Uri.UriSchemeHttps || (uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback))
            || uri.AbsolutePath != "/" || uri.Query != "" || uri.Fragment != "")
            yield return new ValidationResult("Email:AppUrl deve ser https://dominio (ou http://localhost), sem caminho.", [nameof(AppUrl)]);
    }
}
