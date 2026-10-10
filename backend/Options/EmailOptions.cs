using System.ComponentModel.DataAnnotations;

namespace Backend.Options;

// Envio de e-mail (seção "Email"; a chave vem de Email__ApiKey, no deploy/.env, nunca no Git).
// Sem chave, nada é enviado: o desenvolvimento e os testes funcionam sem o serviço.
public class EmailOptions : IValidatableObject
{
    public const string SectionName = "Email";

    // Chave da API do Resend.
    public string? ApiKey { get; set; }

    // Remetente, como "Kliny <nao-responda@kliny.app.br>".
    [Required]
    public string From { get; set; } = string.Empty;

    // Endereço do site, para montar o link do e-mail. Vem da configuração, nunca do cabeçalho Host
    // da requisição: um Host forjado faria o link (com o token) apontar para o site de outra pessoa.
    [Required]
    public string AppUrl { get; set; } = string.Empty;

    // Para onde escrever quando algo der errado, citado nos avisos de segurança.
    [Required, EmailAddress]
    public string Support { get; set; } = string.Empty;

    public bool Enabled => !string.IsNullOrWhiteSpace(ApiKey);

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        // https, ou http só em localhost (desenvolvimento).
        if (!Uri.TryCreate(AppUrl, UriKind.Absolute, out var uri)
            || !(uri.Scheme == Uri.UriSchemeHttps || (uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback))
            || uri.AbsolutePath != "/" || uri.Query != "" || uri.Fragment != "")
            yield return new ValidationResult("Email:AppUrl deve ser https://dominio (ou http://localhost), sem caminho.", [nameof(AppUrl)]);
    }
}
