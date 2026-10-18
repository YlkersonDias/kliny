namespace Backend.Models;

public class Category
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    // Chaves de CategoryAppearance; nulas, cor neutra e etiqueta.
    public string? Color { get; set; }
    public string? Icon { get; set; }

    public User User { get; set; } = null!;
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}
