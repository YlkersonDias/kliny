using Kliny.Api.Data;
using Kliny.Api.DTOs.Recurrences;
using Kliny.Api.Exceptions;
using Kliny.Api.Models;
using Kliny.Api.Resources;
using Microsoft.EntityFrameworkCore;

namespace Kliny.Api.Services;

public class RecurrenceService(AppDbContext db) : IRecurrenceService
{
    public const int MaxPerUser = 50;

    // O resto vem na próxima sincronização.
    public const int MaxCreatedPerSync = 120;

    // Só para o laço de uma regra pausada nunca ser infinito.
    private const int MaxSkippedPerSync = 1200;

    private const int SyncAttempts = 3;

    public async Task<IReadOnlyList<RecurrenceResponse>> ListAsync(int userId) =>
        await Project(db.Recurrences.AsNoTracking().Where(r => r.UserId == userId)
                .OrderBy(r => r.Description).ThenBy(r => r.Id))
            .ToListAsync();

    public async Task<RecurrenceResponse> CreateAsync(int userId, RecurrenceCreateRequest request)
    {
        await EnsureOwnCategoryAsync(userId, request.CategoryId);
        if (await db.Recurrences.CountAsync(r => r.UserId == userId) >= MaxPerUser)
            throw new BusinessRuleException(string.Format(Messages.RecurrenceLimitReached, MaxPerUser));

        var start = request.StartDate!.Value;
        var recurrence = new Recurrence
        {
            UserId = userId,
            Description = request.Description.Trim(),
            Amount = request.Amount!.Value,
            CategoryId = request.CategoryId,
            StartDate = start,
            DayOfMonth = start.Day,
            EndDate = request.EndDate,
            NextDate = start,
        };
        db.Recurrences.Add(recurrence);
        await db.SaveChangesAsync();
        return await GetAsync(userId, recurrence.Id);
    }

    public async Task<RecurrenceResponse> UpdateAsync(int userId, int id, RecurrenceUpdateRequest request)
    {
        var start = await db.Recurrences.Where(r => r.Id == id && r.UserId == userId)
            .Select(r => (DateOnly?)r.StartDate)
            .FirstOrDefaultAsync()
            ?? throw new NotFoundException(Messages.RecurrenceNotFound);
        await EnsureOwnCategoryAsync(userId, request.CategoryId);
        if (request.EndDate is { } end && end < start)
            throw new BusinessRuleException(Messages.RecurrenceEndBeforeStart);

        // Um UPDATE só, sem tocar na NextDate: não esbarra numa sincronização em andamento.
        var description = request.Description.Trim();
        var amount = request.Amount!.Value;
        var updated = await db.Recurrences
            .Where(r => r.Id == id && r.UserId == userId)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(r => r.Description, description)
                .SetProperty(r => r.Amount, amount)
                .SetProperty(r => r.CategoryId, request.CategoryId)
                .SetProperty(r => r.EndDate, request.EndDate)
                .SetProperty(r => r.Paused, request.Paused));
        if (updated == 0)
            throw new NotFoundException(Messages.RecurrenceNotFound);

        return await GetAsync(userId, id);
    }

    public async Task DeleteAsync(int userId, int id)
    {
        var deleted = await db.Recurrences
            .Where(r => r.Id == id && r.UserId == userId)
            .ExecuteDeleteAsync();
        if (deleted == 0)
            throw new NotFoundException(Messages.RecurrenceNotFound);
    }

    public async Task<RecurrenceSyncResponse> SyncAsync(int userId, DateOnly today)
    {
        // Sincronizações simultâneas: a NextDate é o controle de concorrência, e a que chega depois
        // desfaz tudo e tenta de novo, já vendo o que a outra gerou.
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return new RecurrenceSyncResponse(await GenerateAsync(userId, today));
            }
            catch (DbUpdateException ex) when (attempt < SyncAttempts
                && (ex is DbUpdateConcurrencyException || ex.IsDeadlock()))
            {
                db.ChangeTracker.Clear();
            }
        }
    }

    private async Task<int> GenerateAsync(int userId, DateOnly today)
    {
        await using var dbTransaction = await db.Database.BeginTransactionAsync();

        var endOfMonth = RecurrenceSchedule.EndOfMonth(today);
        var due = await db.Recurrences
            .Where(r => r.UserId == userId
                && ((!r.Paused && r.NextDate <= endOfMonth && (r.EndDate == null || r.NextDate <= r.EndDate))
                    || (r.Paused && r.NextDate < today)))
            .OrderBy(r => r.Id)
            .ToListAsync();
        if (due.Count == 0)
            return 0;

        var generated = new List<Transaction>();
        foreach (var recurrence in due)
        {
            if (recurrence.Paused)
            {
                // As datas da pausa não são lançadas: ao retomar, segue de hoje em diante.
                for (var i = 0; i < MaxSkippedPerSync && recurrence.NextDate < today; i++)
                    recurrence.NextDate = RecurrenceSchedule.Next(recurrence.NextDate, recurrence.DayOfMonth);
                continue;
            }

            var limit = recurrence.EndDate is { } end && end < endOfMonth ? end : endOfMonth;
            for (var i = 0; i < MaxCreatedPerSync && recurrence.NextDate <= limit; i++)
            {
                generated.Add(new Transaction
                {
                    UserId = userId,
                    Description = recurrence.Description,
                    Amount = recurrence.Amount,
                    Date = recurrence.NextDate,
                    CategoryId = recurrence.CategoryId,
                    RecurrenceId = recurrence.Id,
                });
                recurrence.NextDate = RecurrenceSchedule.Next(recurrence.NextDate, recurrence.DayOfMonth);
            }
        }

        // Primeiro reserva as regras (UPDATE ... WHERE NextDate = a lida), depois grava as movimentações.
        // Na ordem inversa, as duas travariam as regras para leitura e uma esperaria a outra para sempre.
        await db.SaveChangesAsync();
        db.Transactions.AddRange(generated);
        await db.SaveChangesAsync();
        await dbTransaction.CommitAsync();
        return generated.Count;
    }

    private async Task<RecurrenceResponse> GetAsync(int userId, int id) =>
        await Project(db.Recurrences.AsNoTracking().Where(r => r.Id == id && r.UserId == userId))
            .FirstOrDefaultAsync()
            ?? throw new NotFoundException(Messages.RecurrenceNotFound);

    // As chaves estrangeiras não garantem que a categoria seja do mesmo usuário.
    private async Task EnsureOwnCategoryAsync(int userId, int? categoryId)
    {
        if (categoryId is { } id && !await db.Categories.AnyAsync(c => c.Id == id && c.UserId == userId))
            throw new BusinessRuleException(Messages.CategoryNotFound);
    }

    private static IQueryable<RecurrenceResponse> Project(IQueryable<Recurrence> recurrences) =>
        recurrences.Select(r => new RecurrenceResponse(
            r.Id,
            r.Description,
            r.Amount,
            r.CategoryId,
            r.Category != null ? r.Category.Name : null,
            r.StartDate,
            r.DayOfMonth,
            r.EndDate,
            r.NextDate,
            r.Paused));
}
