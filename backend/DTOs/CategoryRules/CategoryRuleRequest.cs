using System.ComponentModel.DataAnnotations;
using Backend.Resources;

namespace Backend.DTOs.CategoryRules;

// Texto procurado na descrição (sem diferenciar maiúsculas nem acentos) e a categoria sugerida.
public class CategoryRuleRequest
{
    public const int PatternMaxLength = 100;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.CategoryRulePatternRequired))]
    [StringLength(PatternMaxLength, ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.CategoryRulePatternMaxLength))]
    public string Pattern { get; set; } = string.Empty;

    [Required(ErrorMessageResourceType = typeof(Messages), ErrorMessageResourceName = nameof(Messages.CategoryRuleCategoryRequired))]
    public int? CategoryId { get; set; }
}

public record CategoryRuleResponse(int Id, string Pattern, int CategoryId, string CategoryName);

// Aplicar a regra às movimentações existentes. Preview: só conta, sem mudar nada.
// IncludeCategorized: também as que já têm outra categoria (por padrão, só as sem categoria).
public class CategoryRuleApplyQuery
{
    public bool Preview { get; set; }
    public bool IncludeCategorized { get; set; }
}

public record CategoryRuleApplyResponse(int Count);
