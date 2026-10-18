namespace Kliny.Api.Models;

public class User
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    // Null em conta criada só pelo Google: ela não entra pelo login com senha.
    public string? PasswordHash { get; set; }

    // "sub" do ID token do Google.
    public string? GoogleSubject { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Vai no JWT (claim "tv"): incrementar invalida todos os tokens emitidos antes.
    public int TokenVersion { get; set; }

    public ICollection<Category> Categories { get; set; } = new List<Category>();
    public ICollection<Vault> Vaults { get; set; } = new List<Vault>();
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}
