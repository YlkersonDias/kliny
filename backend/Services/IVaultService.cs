using Kliny.Api.DTOs.Vaults;

namespace Kliny.Api.Services;

public interface IVaultService
{
    Task<IReadOnlyList<VaultResponse>> ListAsync(int userId);

    /// <exception cref="Exceptions.NotFoundException">O cofre não existe ou é de outro usuário.</exception>
    Task<VaultResponse> GetAsync(int userId, int id);

    /// <exception cref="Exceptions.ConflictException">O usuário já tem um cofre com esse nome.</exception>
    Task<VaultResponse> CreateAsync(int userId, VaultRequest request);

    /// <exception cref="Exceptions.NotFoundException">O cofre não existe ou é de outro usuário.</exception>
    /// <exception cref="Exceptions.ConflictException">O usuário já tem outro cofre com esse nome.</exception>
    Task<VaultResponse> UpdateAsync(int userId, int id, VaultRequest request);

    /// <summary>Apaga o cofre e, junto, todas as movimentações dele. Só é permitido com saldo zero.</summary>
    /// <exception cref="Exceptions.NotFoundException">O cofre não existe ou é de outro usuário.</exception>
    /// <exception cref="Exceptions.ConflictException">O cofre ainda tem saldo.</exception>
    Task DeleteAsync(int userId, int id);

    /// <summary>Depósito: o dinheiro sai da conta e entra no cofre.</summary>
    /// <remarks>Uma <paramref name="idempotencyKey"/> repetida devolve o lançamento já gravado.</remarks>
    /// <exception cref="Exceptions.NotFoundException">O cofre não existe ou é de outro usuário.</exception>
    /// <exception cref="Exceptions.BusinessRuleException">Saldo da conta insuficiente, ou chave ausente ou inválida.</exception>
    /// <exception cref="Exceptions.UnprocessableException">A chave já foi usada numa operação diferente.</exception>
    Task<VaultOperationResult> DepositAsync(int userId, int id, VaultOperationRequest request, string? idempotencyKey);

    /// <summary>Retirada: o dinheiro sai do cofre e volta para a conta. Mesma idempotência do depósito.</summary>
    /// <exception cref="Exceptions.NotFoundException">O cofre não existe ou é de outro usuário.</exception>
    /// <exception cref="Exceptions.BusinessRuleException">Valor maior que o saldo do cofre, ou chave ausente ou inválida.</exception>
    /// <exception cref="Exceptions.UnprocessableException">A chave já foi usada numa operação diferente.</exception>
    Task<VaultOperationResult> WithdrawAsync(int userId, int id, VaultOperationRequest request, string? idempotencyKey);
}
