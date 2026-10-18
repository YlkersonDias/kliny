using Kliny.Api.DTOs.Budgets;

namespace Kliny.Api.Services;

public interface IBudgetService
{
    /// <summary>Os orçamentos do usuário, com o gasto de cada categoria no mês.</summary>
    Task<IReadOnlyList<BudgetResponse>> ListAsync(int userId, BudgetQuery query);

    /// <summary>Cria ou altera o limite da categoria.</summary>
    /// <exception cref="Exceptions.NotFoundException">A categoria não existe ou é de outro usuário.</exception>
    Task<BudgetLimitResponse> SetAsync(int userId, int categoryId, BudgetRequest request);

    /// <exception cref="Exceptions.NotFoundException">Não há orçamento nessa categoria do usuário.</exception>
    Task DeleteAsync(int userId, int categoryId);
}
