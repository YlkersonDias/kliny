using Backend.Data;
using Backend.DTOs;
using Backend.DTOs.Transactions;
using Backend.Exceptions;
using Backend.Models;
using Backend.Resources;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public class TransactionService(AppDbContext db) : ITransactionService
{
    public async Task<PagedResponse<TransactionResponse>> ListAsync(int userId, TransactionQuery query)
    {
        var transactions = db.Transactions.AsNoTracking().Where(t => t.UserId == userId);

        if (query.From is { } from)
            transactions = transactions.Where(t => t.Date >= from);
        if (query.To is { } to)
            transactions = transactions.Where(t => t.Date <= to);
        if (query.CategoryId is { } categoryId)
            transactions = transactions.Where(t => t.CategoryId == categoryId);
        if (query.Uncategorized)
            transactions = transactions.Where(t => t.CategoryId == null && t.VaultId == null);
        if (query.VaultId is { } vaultId)
            transactions = transactions.Where(t => t.VaultId == vaultId);

        transactions = query.Type switch
        {
            TransactionType.Income => transactions.Where(t => t.VaultId == null && t.Amount > 0),
            TransactionType.Expense => transactions.Where(t => t.VaultId == null && t.Amount < 0),
            TransactionType.Vault => transactions.Where(t => t.VaultId != null),
            _ => transactions,
        };

        // A collation do banco (utf8mb4_0900_ai_ci) faz a busca ignorar maiúsculas e acentos.
        if (query.Search?.Trim() is { Length: > 0 } search)
            transactions = transactions.Where(t => t.Description.Contains(search));

        var totalCount = await transactions.CountAsync();
        var items = await Project(Sort(transactions, query.Sort)
                .Skip((query.Page - 1) * query.PageSize)
                .Take(query.PageSize))
            .ToListAsync();

        return new PagedResponse<TransactionResponse>(items, query.Page, query.PageSize, totalCount);
    }

    // Sempre com desempate pela data e pelo Id, para a paginação nunca repetir nem pular item.
    private static IQueryable<Transaction> Sort(IQueryable<Transaction> transactions, string? sort) => sort switch
    {
        TransactionSort.DateAsc => transactions.OrderBy(t => t.Date).ThenBy(t => t.Id),
        TransactionSort.AmountDesc => transactions.OrderByDescending(t => Math.Abs(t.Amount))
            .ThenByDescending(t => t.Date).ThenByDescending(t => t.Id),
        TransactionSort.AmountAsc => transactions.OrderBy(t => Math.Abs(t.Amount))
            .ThenByDescending(t => t.Date).ThenByDescending(t => t.Id),
        _ => transactions.OrderByDescending(t => t.Date).ThenByDescending(t => t.Id),
    };

    public async Task<TransactionResponse> GetAsync(int userId, int id) =>
        await Project(db.Transactions.AsNoTracking().Where(t => t.Id == id && t.UserId == userId))
            .FirstOrDefaultAsync()
            ?? throw new NotFoundException(Messages.TransactionNotFound);

    public async Task<TransactionResponse> CreateAsync(int userId, TransactionRequest request)
    {
        var transaction = new Transaction { UserId = userId };
        await ApplyAsync(userId, transaction, request);

        db.Transactions.Add(transaction);
        await db.SaveChangesAsync();
        return await GetAsync(userId, transaction.Id);
    }

    public async Task<TransactionResponse> UpdateAsync(int userId, int id, TransactionRequest request)
    {
        var transaction = await FindEditableAsync(userId, id);
        await ApplyAsync(userId, transaction, request);

        await db.SaveChangesAsync();
        return await GetAsync(userId, transaction.Id);
    }

    public async Task DeleteAsync(int userId, int id)
    {
        var transaction = await FindEditableAsync(userId, id);
        db.Transactions.Remove(transaction);
        await db.SaveChangesAsync();
    }

    // Alterar uma operação de cofre aqui mudaria o saldo sem passar pelas regras de depósito e retirada.
    private async Task<Transaction> FindEditableAsync(int userId, int id)
    {
        var transaction = await db.Transactions.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId)
            ?? throw new NotFoundException(Messages.TransactionNotFound);

        if (transaction.VaultId is not null)
            throw new ConflictException(Messages.VaultTransactionReadOnly);

        return transaction;
    }

    private async Task ApplyAsync(int userId, Transaction transaction, TransactionRequest request)
    {
        // As chaves estrangeiras não garantem que a categoria seja do mesmo usuário.
        if (request.CategoryId is { } categoryId
            && !await db.Categories.AnyAsync(c => c.Id == categoryId && c.UserId == userId))
            throw new BusinessRuleException(Messages.CategoryNotFound);

        transaction.Description = request.Description.Trim();
        transaction.Amount = request.Amount!.Value;
        transaction.Date = request.Date!.Value;
        transaction.CategoryId = request.CategoryId;
    }

    private static IQueryable<TransactionResponse> Project(IQueryable<Transaction> transactions) =>
        transactions.Select(t => new TransactionResponse(
            t.Id,
            t.Description,
            t.Amount,
            t.Date,
            t.CategoryId,
            t.Category != null ? t.Category.Name : null,
            t.VaultId,
            t.RecurrenceId,
            t.InstallmentPlanId));
}
