using Backend.DTOs.Vaults;

namespace Backend.Services;

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

    /// <summary>Grava uma transação negativa no cofre: o dinheiro sai da conta e entra no cofre.</summary>
    /// <exception cref="Exceptions.NotFoundException">O cofre não existe ou é de outro usuário.</exception>
    Task<VaultOperationResponse> DepositAsync(int userId, int id, VaultOperationRequest request);

    /// <summary>Grava uma transação positiva no cofre: o dinheiro sai do cofre e volta para a conta.</summary>
    /// <exception cref="Exceptions.NotFoundException">O cofre não existe ou é de outro usuário.</exception>
    /// <exception cref="Exceptions.BusinessRuleException">O valor é maior que o saldo do cofre.</exception>
    Task<VaultOperationResponse> WithdrawAsync(int userId, int id, VaultOperationRequest request);
}
