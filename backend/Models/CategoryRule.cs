namespace Kliny.Api.Models;

// "Descrição contém Pattern → categoria": só sugere, ou é aplicada quando a pessoa pede.
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
