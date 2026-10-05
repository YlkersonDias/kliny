using System.ComponentModel.DataAnnotations;

namespace Backend.DTOs.Transactions;

public enum TransactionType
{
    /// <summary>Receitas: valor positivo, fora de cofre.</summary>
    Income,
    /// <summary>Gastos: valor negativo, fora de cofre.</summary>
    Expense,
    /// <summary>Depósitos e retiradas de cofre.</summary>
    Vault,
}

public class TransactionQuery : IValidatableObject
{
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public int? CategoryId { get; set; }

    /// <summary>Só receitas e gastos sem categoria (operações de cofre ficam de fora, como nos relatórios).</summary>
    public bool Uncategorized { get; set; }

    /// <summary>Extrato de um cofre: só as operações dele.</summary>
    public int? VaultId { get; set; }

    public TransactionType? Type { get; set; }

    // Limite alto o bastante na prática e que impede o estouro do cálculo de Skip.
    [Range(1, 1_000_000, ErrorMessage = "A página deve ficar entre 1 e 1.000.000.")]
    public int Page { get; set; } = 1;

    [Range(1, 100, ErrorMessage = "O tamanho da página deve ficar entre 1 e 100.")]
    public int PageSize { get; set; } = 20;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (From > To)
            yield return new ValidationResult("A data inicial não pode ser depois da data final.", [nameof(From), nameof(To)]);

        if (Uncategorized && CategoryId is not null)
            yield return new ValidationResult("Escolha uma categoria ou \"sem categoria\", não os dois.", [nameof(Uncategorized), nameof(CategoryId)]);

        if (Uncategorized && (Type == TransactionType.Vault || VaultId is not null))
            yield return new ValidationResult("Operações de cofre não têm categoria.", [nameof(Uncategorized)]);
    }
}
