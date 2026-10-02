using Backend.DTOs;
using Backend.DTOs.Transactions;

namespace Backend.Services;

public interface ITransactionService
{
    Task<PagedResponse<TransactionResponse>> ListAsync(int userId, TransactionQuery query);

    /// <exception cref="Exceptions.NotFoundException">A movimentação não existe ou é de outro usuário.</exception>
    Task<TransactionResponse> GetAsync(int userId, int id);

    /// <exception cref="Exceptions.BusinessRuleException">A categoria informada não é do usuário.</exception>
    Task<TransactionResponse> CreateAsync(int userId, TransactionRequest request);

    /// <exception cref="Exceptions.NotFoundException">A movimentação não existe ou é de outro usuário.</exception>
    /// <exception cref="Exceptions.ConflictException">A movimentação é uma operação de cofre.</exception>
    /// <exception cref="Exceptions.BusinessRuleException">A categoria informada não é do usuário.</exception>
    Task<TransactionResponse> UpdateAsync(int userId, int id, TransactionRequest request);

    /// <exception cref="Exceptions.NotFoundException">A movimentação não existe ou é de outro usuário.</exception>
    /// <exception cref="Exceptions.ConflictException">A movimentação é uma operação de cofre.</exception>
    Task DeleteAsync(int userId, int id);
}
