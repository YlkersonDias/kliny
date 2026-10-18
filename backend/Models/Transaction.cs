namespace Backend.Models;

// Amount positivo = receita; negativo = gasto. Com VaultId: depósito é negativo, retirada é positiva.
public class Transaction
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    // Só a data, sem hora: o fuso não muda o dia nos relatórios.
    public DateOnly Date { get; set; }
    public int? CategoryId { get; set; }
    public int? VaultId { get; set; }

    // Só em depósito e retirada: a Idempotency-Key do cliente, única por usuário.
    public string? IdempotencyKey { get; set; }

    public int? RecurrenceId { get; set; }

    public int? InstallmentPlanId { get; set; }

    // SHA-256 da linha do extrato importado, única por usuário: a mesma linha nunca entra duas vezes.
    public string? ImportKey { get; set; }

    public User User { get; set; } = null!;
    public Category? Category { get; set; }
    public Vault? Vault { get; set; }
    public Recurrence? Recurrence { get; set; }
    public InstallmentPlan? InstallmentPlan { get; set; }
}
