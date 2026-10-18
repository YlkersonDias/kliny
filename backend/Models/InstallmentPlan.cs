namespace Backend.Models;

// As parcelas são criadas de uma vez como movimentações de verdade, com "(n/N)" na descrição.
public class InstallmentPlan
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Description { get; set; } = string.Empty;

    // Positivo; as parcelas são gravadas como gasto, negativas.
    public decimal Total { get; set; }
    public int Count { get; set; }

    // O dia dela é o de todas (31 cai no último dia dos meses curtos).
    public DateOnly FirstDate { get; set; }
    public int? CategoryId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Category? Category { get; set; }
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}
