namespace Backend.Models;

// Cadastro esperando a confirmação do e-mail. A conta (User) só é criada quando quem recebeu o
// link escolhe a senha: assim ninguém cria uma conta com o e-mail de outra pessoa e uma senha que
// só ele conhece. Guarda só o SHA-256 do token; vale até ExpiresAt e uma vez só.
public class PendingRegistration
{
    public int Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
