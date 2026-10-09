namespace Backend.Models;

// Orçamento (8.2): limite mensal de gasto de uma categoria, o mesmo para todos os meses.
// Um por categoria; apagar a categoria apaga o orçamento dela.
public class Budget
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int CategoryId { get; set; }
    public decimal Amount { get; set; }

    public User User { get; set; } = null!;
    public Category Category { get; set; } = null!;
}
