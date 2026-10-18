using Kliny.Api.Data;
using Kliny.Api.DTOs.Reports;
using Kliny.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Kliny.Api.Services;

// No banco, gasto e depósito em cofre são negativos; aqui saem positivos.
public class ReportService(AppDbContext db) : IReportService
{
    public async Task<SummaryResponse> GetSummaryAsync(int userId, ReportPeriodQuery query)
    {
        var (from, to) = (query.From!.Value, query.To!.Value);

        var periodTotals = await db.Transactions
            .Where(t => t.UserId == userId && t.Date >= from && t.Date <= to)
            .GroupBy(t => new { IsVault = t.VaultId != null, IsPositive = t.Amount > 0 })
            .Select(g => new { g.Key.IsVault, g.Key.IsPositive, Total = g.Sum(t => t.Amount) })
            .ToListAsync();

        decimal PeriodTotal(bool isVault, bool isPositive) => periodTotals
            .Where(r => r.IsVault == isVault && r.IsPositive == isPositive)
            .Sum(r => r.Total);

        var income = PeriodTotal(isVault: false, isPositive: true);
        var expense = -PeriodTotal(isVault: false, isPositive: false);

        // Saldos no dia "to", desde o primeiro lançamento.
        var balanceTotals = await db.Transactions
            .Where(t => t.UserId == userId && t.Date <= to)
            .GroupBy(t => t.VaultId != null)
            .Select(g => new { IsVault = g.Key, Total = g.Sum(t => t.Amount) })
            .ToListAsync();

        // O depósito tira dinheiro da conta: o saldo da conta soma também as operações de cofre.
        var accountBalance = balanceTotals.Sum(r => r.Total);
        var vaultsBalance = -balanceTotals.Where(r => r.IsVault).Sum(r => r.Total);

        return new SummaryResponse(
            from,
            to,
            income,
            expense,
            income - expense,
            VaultDeposits: -PeriodTotal(isVault: true, isPositive: false),
            VaultWithdrawals: PeriodTotal(isVault: true, isPositive: true),
            accountBalance,
            vaultsBalance);
    }

    public async Task<IReadOnlyList<CategoryTotalResponse>> GetByCategoryAsync(int userId, CategoryReportQuery query)
    {
        var isIncome = query.Type == CategoryReportType.Income;

        var totals = await InPeriod(userId, query)
            .Where(t => isIncome ? t.Amount > 0 : t.Amount < 0)
            .GroupBy(t => t.CategoryId)
            .Select(g => new { CategoryId = g.Key, Total = g.Sum(t => t.Amount), Count = g.Count() })
            .ToListAsync();

        if (totals.Count == 0)
            return [];

        var categoryIds = totals.Where(r => r.CategoryId != null).Select(r => r.CategoryId!.Value).ToList();
        var names = await db.Categories
            .Where(c => c.UserId == userId && categoryIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name);

        var grandTotal = totals.Sum(r => Math.Abs(r.Total));

        return totals
            .Select(r =>
            {
                var total = Math.Abs(r.Total);
                return new CategoryTotalResponse(
                    r.CategoryId,
                    r.CategoryId is { } id ? names.GetValueOrDefault(id) : null,
                    total,
                    r.Count,
                    Math.Round(total / grandTotal * 100, 2, MidpointRounding.AwayFromZero));
            })
            .OrderByDescending(r => r.Total)
            .ThenBy(r => r.CategoryName)
            .ToList();
    }

    public async Task<IReadOnlyList<TimelinePointResponse>> GetTimelineAsync(int userId, TimelineQuery query)
    {
        var (from, to) = (query.From!.Value, query.To!.Value);

        // O banco agrupa por dia e os meses saem daqui, sem depender da tradução de DateOnly.Month pelo Pomelo.
        var daily = await InPeriod(userId, query)
            .GroupBy(t => t.Date)
            .Select(g => new
            {
                Date = g.Key,
                Income = g.Sum(t => t.Amount > 0 ? t.Amount : 0m),
                Expense = g.Sum(t => t.Amount < 0 ? -t.Amount : 0m),
            })
            .ToListAsync();

        Func<DateOnly, DateOnly> bucketOf = query.GroupBy == TimelineGrouping.Day
            ? date => date
            : date => new DateOnly(date.Year, date.Month, 1);
        Func<DateOnly, DateOnly> next = query.GroupBy == TimelineGrouping.Day
            ? date => date.AddDays(1)
            : date => date.AddMonths(1);

        var byBucket = daily
            .GroupBy(d => bucketOf(d.Date))
            .ToDictionary(g => g.Key, g => (Income: g.Sum(d => d.Income), Expense: g.Sum(d => d.Expense)));

        // Todos os períodos, inclusive os sem movimento. Para no último em vez de calcular o seguinte,
        // que estouraria perto de DateOnly.MaxValue.
        var points = new List<TimelinePointResponse>();
        var last = bucketOf(to);
        for (var period = bucketOf(from); ; period = next(period))
        {
            var (income, expense) = byBucket.GetValueOrDefault(period);
            points.Add(new TimelinePointResponse(period, income, expense, income - expense));
            if (period == last)
                break;
        }

        return points;
    }

    // Operações de cofre são transferências internas e ficam de fora.
    private IQueryable<Transaction> InPeriod(int userId, ReportPeriodQuery query)
    {
        var (from, to) = (query.From!.Value, query.To!.Value);
        return db.Transactions.Where(t =>
            t.UserId == userId && t.VaultId == null && t.Date >= from && t.Date <= to);
    }
}
