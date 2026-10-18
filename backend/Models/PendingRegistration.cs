namespace Kliny.Api.Models;

// A conta só é criada quando quem recebeu o link escolhe a senha: ninguém cria uma conta com o
// e-mail de outra pessoa e uma senha que só ele conhece.
public class PendingRegistration
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
