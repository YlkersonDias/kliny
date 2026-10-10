namespace Backend.Models;

// Compra parcelada (8.5b): um gasto dividido em parcelas mensais, todas criadas de uma vez como
// movimentações de verdade (com InstallmentPlanId), com "(n/N)" na descrição. Apagar a compra
// pode levar todas as parcelas ou só as futuras; as que ficam perdem o vínculo.
public class InstallmentPlan
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Description { get; set; } = string.Empty;

    // Valor total da compra, positivo (as parcelas são gravadas como gasto, negativas).
    public decimal Total { get; set; }
    public int Count { get; set; }

    // A primeira parcela. O dia dela é o de todas (31 cai no último dia dos meses curtos).
    public DateOnly FirstDate { get; set; }
    public int? CategoryId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Category? Category { get; set; }
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}
