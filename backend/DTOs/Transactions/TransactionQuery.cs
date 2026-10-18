using System.ComponentModel.DataAnnotations;
using Kliny.Api.Resources;

namespace Kliny.Api.DTOs.Transactions;

public enum TransactionType
{
    /// <summary>Receitas: valor positivo, fora de cofre.</summary>
    Income,
    /// <summary>Gastos: valor negativo, fora de cofre.</summary>
    Expense,
    /// <summary>Depósitos e retiradas de cofre.</summary>
    Vault,
}

// Lista fechada: nunca um nome de coluna vindo de fora.
public static class TransactionSort
{
    public const string DateDesc = "date-desc";
    public const string DateAsc = "date-asc";
    public const string AmountDesc = "amount-desc";
    public const string AmountAsc = "amount-asc";

    public static readonly IReadOnlySet<string> All = new HashSet<string>([DateDesc, DateAsc, AmountDesc, AmountAsc]);
}

public class TransactionQuery : IValidatableObject
{
    public const int SearchMaxLength = 100;

    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    public int? CategoryId { get; set; }

    /// <summary>Só receitas e gastos sem categoria (operações de cofre ficam de fora, como nos relatórios).</summary>
    public bool Uncategorized { get; set; }

    /// <summary>Extrato de um cofre: só as operações dele.</summary>
    public int? VaultId { get; set; }

    public TransactionType? Type { get; set; }

    /// <summary>Texto procurado dentro da descrição (sem diferenciar maiúsculas nem acentos).</summary>
    [StringLength(SearchMaxLength, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.SearchTooLong))]
    public string? Search { get; set; }

    /// <summary>Uma das ordens de <see cref="TransactionSort"/>; vazio = mais recentes primeiro.</summary>
    public string? Sort { get; set; }

    // Impede o estouro do cálculo de Skip.
    [Range(1, 1_000_000, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.PageRange))]
    public int Page { get; set; } = 1;

    [Range(1, 100, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.PageSizeRange))]
    public int PageSize { get; set; } = 20;

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (From > To)
            yield return new ValidationResult(Messages.FromAfterTo, [nameof(From), nameof(To)]);

        if (Uncategorized && CategoryId is not null)
            yield return new ValidationResult(Messages.CategoryAndUncategorized, [nameof(Uncategorized), nameof(CategoryId)]);

        if (Sort is not null && !TransactionSort.All.Contains(Sort))
            yield return new ValidationResult(Messages.SortInvalid, [nameof(Sort)]);

        if (Uncategorized && (Type == TransactionType.Vault || VaultId is not null))
            yield return new ValidationResult(Messages.VaultOperationsHaveNoCategory, [nameof(Uncategorized)]);
    }
}
