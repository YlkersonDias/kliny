using Backend.Data;
using Backend.DTOs.Installments;
using Backend.Exceptions;
using Backend.Models;
using Backend.Resources;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public interface IInstallmentService
{
    /// <summary>As compras parceladas do usuário, com as parcelas que faltam depois de "today".</summary>
    Task<IReadOnlyList<InstallmentResponse>> ListAsync(int userId, DateOnly today);

    /// <summary>Cria a compra e todas as parcelas, numa transação só.</summary>
    /// <exception cref="BusinessRuleException">Categoria de outro usuário ou limite de compras.</exception>
    Task<InstallmentResponse> CreateAsync(int userId, InstallmentCreateRequest request, DateOnly today);

    /// <summary>Apaga a compra e todas as parcelas, ou só as com data depois de "today".</summary>
    /// <exception cref="NotFoundException">A compra não existe ou é de outro usuário.</exception>
    Task DeleteAsync(int userId, int id, string scope, DateOnly today);
}

// Compras parceladas (8.5b). Toda consulta filtra pelo usuário do token (regra 2), além do
// filtro global do AppDbContext.
public class InstallmentService(AppDbContext db) : IInstallmentService
{
    public const int MaxPerUser = 100;

    // Valor de cada parcela, em reais: a divisão é feita em centavos, e a sobra vai na primeira.
    // A soma é sempre exatamente o total (R$ 100 em 3x: 33,34 + 33,33 + 33,33).
    public static decimal[] Split(decimal total, int count)
    {
        var cents = (long)(total * 100);
        var each = cents / count;
        var first = each + cents % count;
        return Enumerable.Range(0, count).Select(i => (i == 0 ? first : each) / 100m).ToArray();
    }

    public static DateOnly[] Dates(DateOnly first, int count)
    {
        var dates = new DateOnly[count];
        dates[0] = first;
        for (var i = 1; i < count; i++)
            dates[i] = RecurrenceSchedule.Next(dates[i - 1], first.Day);
        return dates;
    }

    public async Task<IReadOnlyList<InstallmentResponse>> ListAsync(int userId, DateOnly today)
    {
        var plans = await db.InstallmentPlans.AsNoTracking()
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.FirstDate).ThenByDescending(p => p.Id)
            .Select(p => new
            {
                p.Id, p.Description, p.Total, p.Count, p.CategoryId,
                CategoryName = p.Category != null ? p.Category.Name : null,
                p.FirstDate,
                Remaining = p.Transactions.Count(t => t.Date > today),
            })
            .ToListAsync();

        return plans
            .Select(p => new InstallmentResponse(p.Id, p.Description, p.Total, p.Count, p.CategoryId, p.CategoryName,
                p.FirstDate, Dates(p.FirstDate, p.Count)[^1], p.Remaining))
            .ToList();
    }

    public async Task<InstallmentResponse> CreateAsync(int userId, InstallmentCreateRequest request, DateOnly today)
    {
        if (request.CategoryId is { } categoryId
            && !await db.Categories.AnyAsync(c => c.Id == categoryId && c.UserId == userId))
            throw new BusinessRuleException(Messages.CategoryNotFound);
        if (await db.InstallmentPlans.CountAsync(p => p.UserId == userId) >= MaxPerUser)
            throw new BusinessRuleException(string.Format(Messages.InstallmentLimitReached, MaxPerUser));

        var description = request.Description.Trim();
        var count = request.Count!.Value;
        var amounts = Split(request.Total!.Value, count);
        var dates = Dates(request.FirstDate!.Value, count);
        var plan = new InstallmentPlan
        {
            UserId = userId,
            Description = description,
            Total = request.Total.Value,
            Count = count,
            FirstDate = dates[0],
            CategoryId = request.CategoryId,
        };
        for (var i = 0; i < count; i++)
        {
            plan.Transactions.Add(new Transaction
            {
                UserId = userId,
                Description = $"{description} ({i + 1}/{count})",
                Amount = -amounts[i],
                Date = dates[i],
                CategoryId = request.CategoryId,
            });
        }

        // Um SaveChanges só: a compra e as parcelas entram juntas, ou nada entra.
        db.InstallmentPlans.Add(plan);
        await db.SaveChangesAsync();

        return (await ListAsync(userId, today)).First(p => p.Id == plan.Id);
    }

    public async Task DeleteAsync(int userId, int id, string scope, DateOnly today)
    {
        await using var dbTransaction = await db.Database.BeginTransactionAsync();

        if (!await db.InstallmentPlans.AnyAsync(p => p.Id == id && p.UserId == userId))
            throw new NotFoundException(Messages.InstallmentNotFound);

        var installments = db.Transactions.Where(t => t.InstallmentPlanId == id && t.UserId == userId);
        if (scope == InstallmentDeleteScope.Future)
            installments = installments.Where(t => t.Date > today);
        await installments.ExecuteDeleteAsync();

        // As parcelas que ficaram perdem o vínculo (SET NULL) e continuam com o "(n/N)" na descrição.
        await db.InstallmentPlans.Where(p => p.Id == id && p.UserId == userId).ExecuteDeleteAsync();
        await dbTransaction.CommitAsync();
    }
}
