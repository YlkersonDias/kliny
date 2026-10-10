namespace Backend.Models;

// Link de "Esqueci minha senha". O banco guarda só o SHA-256 do token que vai no e-mail: quem lê o
// banco (ou um backup) não consegue trocar a senha de ninguém. Vale até ExpiresAt e uma vez só (é
// apagado ao ser usado); pedir outro link encerra os anteriores (ExpiresAt passa a ser agora).
public class PasswordResetToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
