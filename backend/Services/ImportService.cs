using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Backend.Data;
using Backend.DTOs.Imports;
using Backend.Exceptions;
using Backend.Models;
using Backend.Resources;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public interface IImportService
{
    /// <summary>A situação de cada linha: nova, já importada ou parecida com um lançamento existente.</summary>
    /// <exception cref="BusinessRuleException">A mesma linha aparece duas vezes.</exception>
    Task<ImportCheckResponse> CheckAsync(int userId, IReadOnlyList<ImportLine> lines);

    /// <summary>Grava as linhas ainda não importadas, todas numa transação só.</summary>
    /// <exception cref="BusinessRuleException">Categoria de outro usuário ou linha repetida.</exception>
    Task<ImportResponse> ImportAsync(int userId, IReadOnlyList<ImportLine> lines);
}

// O arquivo é lido no navegador; aqui chegam só as linhas. A chave de importação, única por
// usuário, impede que a mesma linha entre duas vezes.
public class ImportService(AppDbContext db) : IImportService
{
    private const int ImportAttempts = 3;

    // SHA-256 das partes que identificam a linha no banco de origem. O "v1" deixa mudar a fórmula.
    public static string Key(ImportLine line)
    {
        var parts = string.Join('\n',
            "v1",
            line.Source.Trim(),
            line.ExternalId?.Trim() ?? string.Empty,
            line.Date!.Value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            line.Amount!.Value.ToString("0.00", CultureInfo.InvariantCulture),
            line.ExternalId is null ? line.Description.Trim() : string.Empty,
            line.Occurrence.ToString(CultureInfo.InvariantCulture));
        return Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(parts)));
    }

    public async Task<ImportCheckResponse> CheckAsync(int userId, IReadOnlyList<ImportLine> lines)
    {
        var keys = KeysOf(lines);
        var imported = await ExistingKeysAsync(userId, keys);

        // Mesma data e mesmo valor, fora as operações de cofre: pode ser a mesma movimentação lançada à mão.
        var from = lines.Min(l => l.Date!.Value);
        var to = lines.Max(l => l.Date!.Value);
        var existing = await db.Transactions.AsNoTracking()
            .Where(t => t.UserId == userId && t.VaultId == null && t.Date >= from && t.Date <= to)
            .Select(t => new { t.Date, t.Amount })
            .ToListAsync();
        var similar = existing.Select(t => (t.Date, t.Amount)).ToHashSet();

        var statuses = lines.Select((line, i) =>
            imported.Contains(keys[i]) ? ImportLineStatus.Imported
            : similar.Contains((line.Date!.Value, line.Amount!.Value)) ? ImportLineStatus.Similar
            : ImportLineStatus.New).ToList();
        return new ImportCheckResponse(statuses);
    }

    public async Task<ImportResponse> ImportAsync(int userId, IReadOnlyList<ImportLine> lines)
    {
        var keys = KeysOf(lines);

        var categoryIds = lines.Where(l => l.CategoryId is not null).Select(l => l.CategoryId!.Value).Distinct().ToList();
        if (categoryIds.Count > 0
            && await db.Categories.CountAsync(c => c.UserId == userId && categoryIds.Contains(c.Id)) != categoryIds.Count)
            throw new BusinessRuleException(Messages.CategoryNotFound);

        // O índice único garante que cada linha entra uma vez só; em colisão ou deadlock, tenta de novo.
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await InsertAsync(userId, lines, keys);
            }
            catch (DbUpdateException ex) when (attempt < ImportAttempts && (ex.IsUniqueViolation() || ex.IsDeadlock()))
            {
                db.ChangeTracker.Clear();
            }
        }
    }

    private async Task<ImportResponse> InsertAsync(int userId, IReadOnlyList<ImportLine> lines, string[] keys)
    {
        await using var dbTransaction = await db.Database.BeginTransactionAsync();
        // Trava a linha do usuário, como o depósito: importações simultâneas passam uma de cada vez,
        // e a leitura das chaves, depois da trava, enxerga o que a anterior gravou.
        await db.Database.ExecuteSqlAsync($"SELECT Id FROM Users WHERE Id = {userId} FOR UPDATE");
        var imported = await ExistingKeysAsync(userId, keys);

        var created = 0;
        for (var i = 0; i < lines.Count; i++)
        {
            if (imported.Contains(keys[i]))
                continue;
            var line = lines[i];
            db.Transactions.Add(new Transaction
            {
                UserId = userId,
                Description = line.Description.Trim(),
                Amount = line.Amount!.Value,
                Date = line.Date!.Value,
                CategoryId = line.CategoryId,
                ImportKey = keys[i],
            });
            created++;
        }

        await db.SaveChangesAsync();
        await dbTransaction.CommitAsync();
        return new ImportResponse(created, lines.Count - created);
    }

    private static string[] KeysOf(IReadOnlyList<ImportLine> lines)
    {
        var keys = lines.Select(Key).ToArray();
        if (keys.Distinct().Count() != keys.Length)
            throw new BusinessRuleException(Messages.ImportDuplicateLine);
        return keys;
    }

    // Lista, e não array: no .NET 10 o Contains de array vira o de ReadOnlySpan, que o EF 9 não traduz.
    private async Task<HashSet<string>> ExistingKeysAsync(int userId, string[] keys)
    {
        var list = keys.ToList();
        return (await db.Transactions.AsNoTracking()
            .Where(t => t.UserId == userId && t.ImportKey != null && list.Contains(t.ImportKey))
            .Select(t => t.ImportKey!)
            .ToListAsync())
            .ToHashSet();
    }
}
