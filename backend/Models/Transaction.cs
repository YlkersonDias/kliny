namespace Backend.Models;

// Amount positivo = receita; negativo = gasto.
// Com VaultId: depósito no cofre é negativo, retirada é positiva.
public class Transaction
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    // Só a data, sem hora: evita que o fuso mude o dia do lançamento nos relatórios.
    public DateOnly Date { get; set; }
    public int? CategoryId { get; set; }
    public int? VaultId { get; set; }

    // Só em depósito e retirada: a chave Idempotency-Key enviada pelo cliente, única por usuário.
    // Um envio repetido com a mesma chave devolve o lançamento já gravado, sem criar outro.
    public string? IdempotencyKey { get; set; }

    // Gerada por um lançamento recorrente (8.5a). Fica nula se a regra for apagada.
    public int? RecurrenceId { get; set; }

    // Parcela de uma compra parcelada (8.5b). Fica nula se a compra for apagada.
    public int? InstallmentPlanId { get; set; }

    // Importada de um extrato (8.3): SHA-256 da linha no banco de origem, única por usuário, para
    // a mesma linha nunca entrar duas vezes. Nula nas movimentações lançadas no app.
    public string? ImportKey { get; set; }

    public User User { get; set; } = null!;
    public Category? Category { get; set; }
    public Vault? Vault { get; set; }
    public Recurrence? Recurrence { get; set; }
    public InstallmentPlan? InstallmentPlan { get; set; }
}
