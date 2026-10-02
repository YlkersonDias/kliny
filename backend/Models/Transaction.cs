namespace Backend.Models;

// Amount positivo = receita; negativo = gasto.
// Com VaultId: depósito no cofre é negativo, retirada é positiva.
public class Transaction
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime Date { get; set; }
    public int? CategoryId { get; set; }
    public int? VaultId { get; set; }

    public User User { get; set; } = null!;
    public Category? Category { get; set; }
    public Vault? Vault { get; set; }
}
