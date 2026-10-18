using Kliny.Api.DTOs.Recurrences;

namespace Kliny.Api.Services;

public interface IRecurrenceService
{
    /// <summary>As recorrências do usuário, em ordem de descrição.</summary>
    Task<IReadOnlyList<RecurrenceResponse>> ListAsync(int userId);

    /// <exception cref="Exceptions.BusinessRuleException">Categoria de outro usuário ou limite de recorrências.</exception>
    Task<RecurrenceResponse> CreateAsync(int userId, RecurrenceCreateRequest request);

    /// <exception cref="Exceptions.NotFoundException">A recorrência não existe ou é de outro usuário.</exception>
    Task<RecurrenceResponse> UpdateAsync(int userId, int id, RecurrenceUpdateRequest request);

    /// <summary>Apaga a regra. As movimentações já geradas ficam, sem o vínculo.</summary>
    /// <exception cref="Exceptions.NotFoundException">A recorrência não existe ou é de outro usuário.</exception>
    Task DeleteAsync(int userId, int id);

    /// <summary>Gera as ocorrências que faltam até o fim do mês de hoje. Devolve quantas criou.</summary>
    Task<RecurrenceSyncResponse> SyncAsync(int userId, DateOnly today);
}
