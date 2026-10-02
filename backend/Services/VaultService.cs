using System.Globalization;
using Backend.Data;
using Backend.DTOs.Transactions;
using Backend.DTOs.Vaults;
using Backend.Exceptions;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class VaultService(AppDbContext db) : IVaultService
{
    private const string NotFoundMessage = "Cofre não encontrado.";
    private const string DuplicateNameMessage = "Já existe um cofre com esse nome.";
    private const string HasBalanceMessage = "Retire o saldo antes de apagar o cofre.";
    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");

    public async Task<IReadOnlyList<VaultResponse>> ListAsync(int userId) =>
        await Project(db.Vaults.AsNoTracking().Where(v => v.UserId == userId).OrderBy(v => v.Name))
            .ToListAsync();

    public async Task<VaultResponse> GetAsync(int userId, int id) =>
        await Project(db.Vaults.AsNoTracking().Where(v => v.Id == id && v.UserId == userId))
            .FirstOrDefaultAsync()
            ?? throw new NotFoundException(NotFoundMessage);

    public async Task<VaultResponse> CreateAsync(int userId, VaultRequest request)
    {
        var vault = new Vault { UserId = userId };
        Apply(vault, request);
        db.Vaults.Add(vault);
        await SaveAsync(userId, vault);
        return new VaultResponse(vault.Id, vault.Name, vault.Goal, 0m, vault.CreatedAt);
    }

    public async Task<VaultResponse> UpdateAsync(int userId, int id, VaultRequest request)
    {
        var vault = await db.Vaults.FirstOrDefaultAsync(v => v.Id == id && v.UserId == userId)
            ?? throw new NotFoundException(NotFoundMessage);
        Apply(vault, request);
        await SaveAsync(userId, vault);
        return await GetAsync(userId, id);
    }

    public async Task DeleteAsync(int userId, int id)
    {
        await using var dbTransaction = await db.Database.BeginTransactionAsync();
        var vault = await LockOwnedAsync(userId, id);

        if (await GetBalanceAsync(vault.Id) != 0)
            throw new ConflictException(HasBalanceMessage);

        // Com saldo zero, depósitos e retiradas se anulam e os relatórios já os ignoram,
        // então apagá-los não muda os totais da conta. O histórico do cofre se perde.
        await db.Transactions.Where(t => t.VaultId == vault.Id).ExecuteDeleteAsync();
        db.Vaults.Remove(vault);
        await db.SaveChangesAsync();

        await dbTransaction.CommitAsync();
    }

    public Task<VaultOperationResponse> DepositAsync(int userId, int id, VaultOperationRequest request) =>
        OperateAsync(userId, id, request, isWithdrawal: false);

    public Task<VaultOperationResponse> WithdrawAsync(int userId, int id, VaultOperationRequest request) =>
        OperateAsync(userId, id, request, isWithdrawal: true);

    private async Task<VaultOperationResponse> OperateAsync(
        int userId, int id, VaultOperationRequest request, bool isWithdrawal)
    {
        var amount = request.Amount!.Value;

        await using var dbTransaction = await db.Database.BeginTransactionAsync();
        var vault = await LockOwnedAsync(userId, id);
        var balance = await GetBalanceAsync(vault.Id);

        if (isWithdrawal && amount > balance)
            throw new BusinessRuleException(
                $"Saldo insuficiente no cofre. Disponível: {balance.ToString("C", PtBr)}.");

        var description = string.IsNullOrWhiteSpace(request.Description)
            ? (isWithdrawal ? $"Retirada do cofre {vault.Name}" : $"Depósito no cofre {vault.Name}")
            : request.Description.Trim();

        var transaction = new Transaction
        {
            UserId = userId,
            VaultId = vault.Id,
            Description = description,
            // Depósito é negativo (sai da conta); retirada é positiva (volta para a conta).
            Amount = isWithdrawal ? amount : -amount,
            Date = request.Date!.Value,
        };
        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();
        await dbTransaction.CommitAsync();

        return new VaultOperationResponse(
            new TransactionResponse(transaction.Id, transaction.Description, transaction.Amount,
                transaction.Date, null, null, vault.Id),
            balance - transaction.Amount);
    }

    // Trava a linha do cofre até o fim da transação de banco. Duas retiradas simultâneas
    // passariam juntas pela checagem de saldo; com a trava, a segunda espera a primeira
    // terminar e já enxerga o saldo atualizado.
    // A consulta não pode ser composta (Where, FirstOrDefault...): o EF a colocaria numa
    // subconsulta, e o FOR UPDATE precisa ficar no SELECT externo.
    private async Task<Vault> LockOwnedAsync(int userId, int id)
    {
        var vaults = await db.Vaults
            .FromSql($"SELECT * FROM Vaults WHERE Id = {id} AND UserId = {userId} FOR UPDATE")
            .ToListAsync();

        return vaults.SingleOrDefault() ?? throw new NotFoundException(NotFoundMessage);
    }

    // Saldo = soma dos valores do cofre com o sinal invertido.
    private async Task<decimal> GetBalanceAsync(int vaultId) =>
        -(await db.Transactions.Where(t => t.VaultId == vaultId).SumAsync(t => (decimal?)t.Amount) ?? 0m);

    private static void Apply(Vault vault, VaultRequest request)
    {
        vault.Name = request.Name.Trim();
        vault.Goal = request.Goal;
    }

    private async Task SaveAsync(int userId, Vault vault)
    {
        // A comparação usa a collation do banco, a mesma do índice único.
        if (await db.Vaults.AnyAsync(v => v.UserId == userId && v.Name == vault.Name && v.Id != vault.Id))
            throw new ConflictException(DuplicateNameMessage);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            throw new ConflictException(DuplicateNameMessage);
        }
    }

    private static IQueryable<VaultResponse> Project(IQueryable<Vault> vaults) =>
        vaults.Select(v => new VaultResponse(
            v.Id,
            v.Name,
            v.Goal,
            -(v.Transactions.Sum(t => (decimal?)t.Amount) ?? 0m),
            v.CreatedAt));
}
