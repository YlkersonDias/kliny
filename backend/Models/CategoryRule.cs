namespace Backend.Models;

// Regra de categoria (8.4): "descrição contém Pattern → categoria". Só sugere no formulário (o
// frontend preenche a categoria, e a pessoa pode trocar) ou é aplicada às movimentações existentes
// quando a pessoa pede. Um texto por usuário; apagar a categoria apaga as regras dela.
public class CategoryRule
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Pattern { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Category Category { get; set; } = null!;
}
