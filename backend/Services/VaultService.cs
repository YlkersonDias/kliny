using Backend.Data;
using Backend.DTOs.Transactions;
using Backend.DTOs.Vaults;
using Backend.Exceptions;
using Backend.Localization;
using Backend.Models;
using Backend.Resources;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class VaultService(AppDbContext db) : IVaultService
{
    public async Task<IReadOnlyList<VaultResponse>> ListAsync(int userId) =>
        await Project(db.Vaults.AsNoTracking().Where(v => v.UserId == userId).OrderBy(v => v.Name))
            .ToListAsync();

    public async Task<VaultResponse> GetAsync(int userId, int id) =>
        await Project(db.Vaults.AsNoTracking().Where(v => v.Id == id && v.UserId == userId))
            .FirstOrDefaultAsync()
            ?? throw new NotFoundException(Messages.VaultNotFound);

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
            ?? throw new NotFoundException(Messages.VaultNotFound);
        Apply(vault, request);
        await SaveAsync(userId, vault);
        return await GetAsync(userId, id);
    }

    public async Task DeleteAsync(int userId, int id)
    {
        await using var dbTransaction = await db.Database.BeginTransactionAsync();
        var vault = await LockOwnedAsync(userId, id);

        if (await GetBalanceAsync(vault.Id) != 0)
            throw new ConflictException(Messages.VaultHasBalance);

        // Com saldo zero, as operações se anulam: apagá-las não muda os totais da conta.
        await db.Transactions.Where(t => t.VaultId == vault.Id).ExecuteDeleteAsync();
        db.Vaults.Remove(vault);
        await db.SaveChangesAsync();

        await dbTransaction.CommitAsync();
    }

    public Task<VaultOperationResult> DepositAsync(int userId, int id, VaultOperationRequest request, string? idempotencyKey) =>
        OperateAsync(userId, id, request, idempotencyKey, isWithdrawal: false);

    public Task<VaultOperationResult> WithdrawAsync(int userId, int id, VaultOperationRequest request, string? idempotencyKey) =>
        OperateAsync(userId, id, request, idempotencyKey, isWithdrawal: true);

    private async Task<VaultOperationResult> OperateAsync(
        int userId, int id, VaultOperationRequest request, string? idempotencyKey, bool isWithdrawal)
    {
        // Obrigatória: sem ela, um envio repetido gravaria duas vezes.
        if (string.IsNullOrEmpty(idempotencyKey))
            throw new BusinessRuleException(Messages.IdempotencyKeyRequired);
        if (!IdempotencyKey.IsValid(idempotencyKey))
            throw new BusinessRuleException(Messages.IdempotencyKeyInvalid);

        var amount = request.Amount!.Value;
        var date = request.Date!.Value;
        var signedAmount = isWithdrawal ? amount : -amount;

        await using var dbTransaction = await db.Database.BeginTransactionAsync();
        // Depósito trava a conta antes do cofre, para depósitos simultâneos (mesmo em cofres
        // diferentes) não passarem juntos pela checagem de saldo. A ordem das travas é sempre a mesma.
        if (!isWithdrawal)
            await db.Database.ExecuteSqlAsync($"SELECT Id FROM Users WHERE Id = {userId} FOR UPDATE");
        var vault = await LockOwnedAsync(userId, id);

        // Repetição: devolve o que já foi gravado, antes de conferir saldos. Depois das travas, para
        // enxergar o que uma requisição simultânea com a mesma chave acabou de gravar.
        if (await FindByKeyAsync(userId, idempotencyKey) is { } previous)
            return await ReplayAsync(previous, vault.Id, signedAmount, date);

        var balance = await GetBalanceAsync(vault.Id);

        if (isWithdrawal && amount > balance)
            throw new BusinessRuleException(
                string.Format(Messages.VaultInsufficientBalance, AppCultures.FormatMoney(balance)));

        if (!isWithdrawal)
        {
            // Saldo da conta na data do depósito, inclusive operações de cofre.
            var available = await GetAccountBalanceAsync(userId, date);
            if (amount > available)
            {
                var message = string.Format(Messages.AccountInsufficientBalance,
                    AppCultures.FormatDate(date), AppCultures.FormatMoney(available));
                if (available <= 0)
                    message += " " + Messages.AddIncomeBeforeDeposit;
                throw new BusinessRuleException(message);
            }
        }

        var description = string.IsNullOrWhiteSpace(request.Description)
            ? string.Format(isWithdrawal ? Messages.WithdrawalDescription : Messages.DepositDescription, vault.Name)
            : request.Description.Trim();

        var transaction = new Transaction
        {
            UserId = userId,
            VaultId = vault.Id,
            Description = description,
            Amount = signedAmount,
            Date = date,
            IdempotencyKey = idempotencyKey,
        };
        db.Transactions.Add(transaction);
        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            // A mesma chave chegou ao mesmo tempo por outro cofre e gravou antes.
            await dbTransaction.RollbackAsync();
            db.ChangeTracker.Clear();
            var winner = await FindByKeyAsync(userId, idempotencyKey) ?? throw new InvalidOperationException(
                "Violação do índice de idempotência sem o lançamento correspondente.", ex);
            return await ReplayAsync(winner, vault.Id, signedAmount, date);
        }
        await dbTransaction.CommitAsync();

        return new VaultOperationResult(
            new VaultOperationResponse(ToResponse(transaction), balance - transaction.Amount),
            Replayed: false);
    }

    private Task<Transaction?> FindByKeyAsync(int userId, string idempotencyKey) =>
        db.Transactions.AsNoTracking()
            .FirstOrDefaultAsync(t => t.UserId == userId && t.IdempotencyKey == idempotencyKey);

    // A chave só vale para a mesma operação (cofre, valor com sinal e data); a descrição não entra.
    private async Task<VaultOperationResult> ReplayAsync(
        Transaction previous, int vaultId, decimal signedAmount, DateOnly date)
    {
        if (previous.VaultId != vaultId || previous.Amount != signedAmount || previous.Date != date)
            throw new UnprocessableException(Messages.IdempotencyKeyReused);

        return new VaultOperationResult(
            new VaultOperationResponse(ToResponse(previous), await GetBalanceAsync(vaultId)),
            Replayed: true);
    }

    private static TransactionResponse ToResponse(Transaction transaction) =>
        new(transaction.Id, transaction.Description, transaction.Amount, transaction.Date, null, null, transaction.VaultId, null, null);

    // Trava a linha do cofre até o fim da transação: sem ela, duas retiradas simultâneas passariam
    // juntas pela checagem de saldo. Não pode ser composta: o FOR UPDATE precisa ficar no SELECT de fora.
    private async Task<Vault> LockOwnedAsync(int userId, int id)
    {
        var vaults = await db.Vaults
            .FromSql($"SELECT * FROM Vaults WHERE Id = {id} AND UserId = {userId} FOR UPDATE")
            // O filtro global poria o SQL numa subconsulta; o dono já está filtrado no próprio SQL.
            .IgnoreQueryFilters()
            .ToListAsync();

        return vaults.SingleOrDefault() ?? throw new NotFoundException(Messages.VaultNotFound);
    }

    private async Task<decimal> GetBalanceAsync(int vaultId) =>
        -(await db.Transactions.Where(t => t.VaultId == vaultId).SumAsync(t => (decimal?)t.Amount) ?? 0m);

    // Saldo da conta no fim do dia: cumulativo, o mesmo cálculo do resumo dos relatórios.
    private async Task<decimal> GetAccountBalanceAsync(int userId, DateOnly date) =>
        await db.Transactions.Where(t => t.UserId == userId && t.Date <= date).SumAsync(t => (decimal?)t.Amount) ?? 0m;

    private static void Apply(Vault vault, VaultRequest request)
    {
        vault.Name = request.Name.Trim();
        vault.Goal = request.Goal;
    }

    private async Task SaveAsync(int userId, Vault vault)
    {
        if (await db.Vaults.AnyAsync(v => v.UserId == userId && v.Name == vault.Name && v.Id != vault.Id))
            throw new ConflictException(Messages.VaultDuplicateName);

        try
        {
            await db.SaveChangesAsync();
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            throw new ConflictException(Messages.VaultDuplicateName);
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
