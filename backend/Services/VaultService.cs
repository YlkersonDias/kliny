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

        // Com saldo zero, depósitos e retiradas se anulam e os relatórios já os ignoram,
        // então apagá-los não muda os totais da conta. O histórico do cofre se perde.
        await db.Transactions.Where(t => t.VaultId == vault.Id).ExecuteDeleteAsync();
        db.Vaults.Remove(vault);
        await db.SaveChangesAsync();

        await dbTransaction.CommitAsync();
    }

    public Task<VaultOperationResult> DepositAsync(int userId, int id, VaultOperationRequest request, string? idempotencyKey = null) =>
        OperateAsync(userId, id, request, idempotencyKey, isWithdrawal: false);

    public Task<VaultOperationResult> WithdrawAsync(int userId, int id, VaultOperationRequest request, string? idempotencyKey = null) =>
        OperateAsync(userId, id, request, idempotencyKey, isWithdrawal: true);

    private async Task<VaultOperationResult> OperateAsync(
        int userId, int id, VaultOperationRequest request, string? idempotencyKey, bool isWithdrawal)
    {
        if (idempotencyKey is not null && !IdempotencyKey.IsValid(idempotencyKey))
            throw new BusinessRuleException(Messages.IdempotencyKeyInvalid);

        var amount = request.Amount!.Value;
        var date = request.Date!.Value;
        // Depósito é negativo (sai da conta); retirada é positiva (volta para a conta).
        var signedAmount = isWithdrawal ? amount : -amount;

        await using var dbTransaction = await db.Database.BeginTransactionAsync();
        // Depósito: trava a conta (linha do usuário) antes do cofre, para dois depósitos ao mesmo
        // tempo, mesmo em cofres diferentes, não passarem juntos pela checagem do saldo da conta.
        // Só o depósito trava o usuário, e sempre antes do cofre: a ordem é sempre a mesma.
        if (!isWithdrawal)
            await db.Database.ExecuteSqlAsync($"SELECT Id FROM Users WHERE Id = {userId} FOR UPDATE");
        var vault = await LockOwnedAsync(userId, id);

        // Envio repetido: devolve o que já foi gravado, antes de conferir saldos (uma retirada que
        // esvaziou o cofre seria recusada na repetição). A consulta vem depois das travas, então
        // enxerga o que uma requisição simultânea com a mesma chave acabou de gravar.
        if (idempotencyKey is not null && await FindByKeyAsync(userId, idempotencyKey) is { } previous)
            return await ReplayAsync(previous, vault.Id, signedAmount, date);

        var balance = await GetBalanceAsync(vault.Id);

        if (isWithdrawal && amount > balance)
            throw new BusinessRuleException(
                string.Format(Messages.VaultInsufficientBalance, AppCultures.FormatMoney(balance)));

        if (!isWithdrawal)
        {
            // Só deposita o que a conta tem na data do depósito: soma de tudo desde o início da conta
            // até essa data, inclusive operações de cofre (o depósito tira dinheiro da conta).
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

        // A descrição padrão sai no idioma da requisição e fica gravada assim: quem troca de idioma
        // pode ter, no mesmo extrato, descrições nos dois idiomas.
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
        catch (DbUpdateException ex) when (idempotencyKey is not null && ex.IsUniqueViolation())
        {
            // A mesma chave chegou ao mesmo tempo por outro cofre (travas diferentes) e gravou antes.
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

    // A mesma chave só vale para a mesma operação: mesmo cofre, mesmo valor com o mesmo sinal
    // (depósito ou retirada) e mesma data. A descrição não entra: a padrão depende do idioma.
    // O saldo devolvido é o atual do cofre, que pode ter mudado desde o envio original.
    private async Task<VaultOperationResult> ReplayAsync(
        Transaction previous, int vaultId, decimal signedAmount, DateOnly date)
    {
        if (previous.VaultId != vaultId || previous.Amount != signedAmount || previous.Date != date)
            throw new ConflictException(Messages.IdempotencyKeyReused);

        return new VaultOperationResult(
            new VaultOperationResponse(ToResponse(previous), await GetBalanceAsync(vaultId)),
            Replayed: true);
    }

    private static TransactionResponse ToResponse(Transaction transaction) =>
        new(transaction.Id, transaction.Description, transaction.Amount, transaction.Date, null, null, transaction.VaultId);

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

        return vaults.SingleOrDefault() ?? throw new NotFoundException(Messages.VaultNotFound);
    }

    // Saldo = soma dos valores do cofre com o sinal invertido.
    private async Task<decimal> GetBalanceAsync(int vaultId) =>
        -(await db.Transactions.Where(t => t.VaultId == vaultId).SumAsync(t => (decimal?)t.Amount) ?? 0m);

    // Saldo da conta no fim do dia: soma de todos os valores até a data (cumulativo, não reseta
    // por mês). É o mesmo cálculo do accountBalance do relatório de resumo.
    private async Task<decimal> GetAccountBalanceAsync(int userId, DateOnly date) =>
        await db.Transactions.Where(t => t.UserId == userId && t.Date <= date).SumAsync(t => (decimal?)t.Amount) ?? 0m;

    private static void Apply(Vault vault, VaultRequest request)
    {
        vault.Name = request.Name.Trim();
        vault.Goal = request.Goal;
    }

    private async Task SaveAsync(int userId, Vault vault)
    {
        // A comparação usa a collation do banco, a mesma do índice único.
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
