namespace Backend.Models;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    // Null em conta criada só pelo Google: ela não entra pelo login com senha.
    public string? PasswordHash { get; set; }

    // Identificador fixo da conta Google vinculada ("sub" do ID token), único. Null sem Google.
    public string? GoogleSubject { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Versão dos tokens (S.5): vai no JWT (claim "tv") e é conferida a cada requisição.
    // "Sair de todos os dispositivos" incrementa, e os tokens emitidos antes deixam de valer.
    public int TokenVersion { get; set; }

    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<Vault> Vaults { get; set; } = new List<Vault>();
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}
