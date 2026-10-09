namespace Backend.Models;

// Lançamento recorrente (8.5a): uma receita ou um gasto que se repete todo mês, no mesmo dia.
// Não guarda as ocorrências: elas viram movimentações de verdade (com RecurrenceId), geradas pela
// sincronização até o fim do mês atual. Apagar a regra mantém as movimentações já geradas.
public class Recurrence
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Description { get; set; } = string.Empty;

    // Com o sinal da movimentação: positivo = receita; negativo = gasto.
    public decimal Amount { get; set; }
    public int? CategoryId { get; set; }

    // A primeira ocorrência. O dia dela é o de todos os meses (31 cai no último dia dos meses curtos).
    public DateOnly StartDate { get; set; }
    public int DayOfMonth { get; set; }

    // Última data em que ainda pode haver ocorrência (opcional).
    public DateOnly? EndDate { get; set; }

    // A próxima ocorrência a gerar. Só avança: uma ocorrência gerada e depois apagada não volta.
    // É também o controle de concorrência: duas sincronizações ao mesmo tempo não geram o mesmo mês.
    public DateOnly NextDate { get; set; }

    // Pausada não gera nada; as datas que passam durante a pausa são puladas.
    public bool Paused { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Category? Category { get; set; }
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}
