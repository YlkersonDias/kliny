namespace Kliny.Api.Models;

// As ocorrências viram movimentações de verdade (com RecurrenceId), geradas pela sincronização.
public class Recurrence
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Description { get; set; } = string.Empty;

    // Com o sinal da movimentação.
    public decimal Amount { get; set; }
    public int? CategoryId { get; set; }

    // O dia dela é o de todos os meses (31 cai no último dia dos meses curtos).
    public DateOnly StartDate { get; set; }
    public int DayOfMonth { get; set; }

    public DateOnly? EndDate { get; set; }

    // Só avança: uma ocorrência apagada não volta. É também o controle de concorrência da sincronização.
    public DateOnly NextDate { get; set; }

    // As datas que passam durante a pausa são puladas.
    public bool Paused { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Category? Category { get; set; }
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}
