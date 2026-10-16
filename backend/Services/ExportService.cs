using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Data;
using Backend.Localization;
using Backend.Resources;
using Microsoft.EntityFrameworkCore;

namespace Backend.Services;

public interface IExportService
{
    // O .zip com os dados da pessoa: kliny-dados.json (tudo) e kliny-movimentacoes.csv.
    Task<byte[]> BuildAsync(int userId);
}

// Exportação dos dados (LGPD, portabilidade). Leva tudo o que é da pessoa e nada interno: sem hash
// de senha, identificador do Google, versão do token, chaves de importação e de idempotência, nem os
// Ids do banco (as ligações vão pelos nomes, únicos por usuário). Toda consulta filtra o UserId do
// token, além do filtro global do AppDbContext (regra 2).
public class ExportService(AppDbContext db) : IExportService
{
    public const string JsonFileName = "kliny-dados.json";
    public const string CsvFileName = "kliny-movimentacoes.csv";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        // Acentos legíveis no arquivo; o JSON vai num arquivo, nunca numa página.
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };

    public async Task<byte[]> BuildAsync(int userId)
    {
        var user = await db.Users.AsNoTracking().Where(u => u.Id == userId)
            .Select(u => new ExportAccount(u.Name, u.Email, u.CreatedAt, u.PasswordHash != null, u.GoogleSubject != null))
            .FirstAsync();

        var categories = await db.Categories.AsNoTracking().Where(c => c.UserId == userId)
            .OrderBy(c => c.Name)
            .Select(c => new ExportCategory(c.Name, c.Color, c.Icon))
            .ToListAsync();

        var vaults = await db.Vaults.AsNoTracking().Where(v => v.UserId == userId)
            .OrderBy(v => v.Name)
            .Select(v => new ExportVault(v.Name, v.Goal, -(v.Transactions.Sum(t => (decimal?)t.Amount) ?? 0m), v.CreatedAt))
            .ToListAsync();

        var transactions = await db.Transactions.AsNoTracking().Where(t => t.UserId == userId)
            .OrderBy(t => t.Date).ThenBy(t => t.Id)
            .Select(t => new ExportTransaction(
                t.Date, t.Description, t.Amount,
                t.VaultId == null ? (t.Amount > 0 ? "income" : "expense") : (t.Amount < 0 ? "vault-deposit" : "vault-withdrawal"),
                t.Category == null ? null : t.Category.Name,
                t.Vault == null ? null : t.Vault.Name,
                t.RecurrenceId != null, t.InstallmentPlanId != null, t.ImportKey != null))
            .ToListAsync();

        var budgets = await db.Budgets.AsNoTracking().Where(b => b.UserId == userId)
            .OrderBy(b => b.Category.Name)
            .Select(b => new ExportBudget(b.Category.Name, b.Amount))
            .ToListAsync();

        var recurrences = await db.Recurrences.AsNoTracking().Where(r => r.UserId == userId)
            .OrderBy(r => r.Description)
            .Select(r => new ExportRecurrence(
                r.Description, r.Amount, r.Category == null ? null : r.Category.Name,
                r.StartDate, r.DayOfMonth, r.EndDate, r.NextDate, r.Paused))
            .ToListAsync();

        var installments = await db.InstallmentPlans.AsNoTracking().Where(p => p.UserId == userId)
            .OrderBy(p => p.FirstDate)
            .Select(p => new ExportInstallment(p.Description, p.Total, p.Count, p.FirstDate, p.Category == null ? null : p.Category.Name))
            .ToListAsync();

        var rules = await db.CategoryRules.AsNoTracking().Where(r => r.UserId == userId)
            .OrderBy(r => r.Pattern)
            .Select(r => new ExportCategoryRule(r.Pattern, r.Category.Name))
            .ToListAsync();

        var data = new ExportData(
            Format: "kliny-export", Version: 1, ExportedAt: DateTime.UtcNow,
            user, categories, vaults, transactions, budgets, recurrences, installments, rules);

        using var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, leaveOpen: true))
        {
            await WriteEntryAsync(zip, JsonFileName, JsonSerializer.SerializeToUtf8Bytes(data, JsonOptions));
            await WriteEntryAsync(zip, CsvFileName, BuildCsv(transactions));
        }
        return buffer.ToArray();
    }

    private static async Task WriteEntryAsync(ZipArchive zip, string name, byte[] content)
    {
        var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
        await using var stream = entry.Open();
        await stream.WriteAsync(content);
    }

    // CSV para abrir no Excel: em português, ";" e "1234,56" (o Excel brasileiro usa a vírgula como
    // decimal); em inglês, "," e "1234.56". Com BOM, para o Excel ler os acentos em UTF-8.
    internal static byte[] BuildCsv(IReadOnlyList<ExportTransaction> transactions)
    {
        var english = AppCultures.IsEnglish;
        var separator = english ? ',' : ';';
        var number = english ? CultureInfo.GetCultureInfo(AppCultures.English) : CultureInfo.GetCultureInfo(AppCultures.Portuguese);
        var dateFormat = english ? "MM/dd/yyyy" : "dd/MM/yyyy";

        var csv = new StringBuilder();
        void Line(params string[] fields) => csv.Append(string.Join(separator, fields.Select(f => Quote(f, separator)))).Append("\r\n");

        Line(Messages.ExportCsvDate, Messages.ExportCsvDescription, Messages.ExportCsvAmount,
            Messages.ExportCsvType, Messages.ExportCsvCategory, Messages.ExportCsvVault);
        foreach (var t in transactions)
        {
            Line(
                t.Date.ToString(dateFormat, CultureInfo.InvariantCulture),
                Text(t.Description),
                t.Amount.ToString("0.00", number),
                Kind(t.Kind),
                Text(t.Category ?? ""),
                Text(t.Vault ?? ""));
        }

        var bom = Encoding.UTF8.GetPreamble();
        return [.. bom, .. Encoding.UTF8.GetBytes(csv.ToString())];
    }

    private static string Kind(string kind) => kind switch
    {
        "income" => Messages.ExportKindIncome,
        "expense" => Messages.ExportKindExpense,
        "vault-deposit" => Messages.ExportKindVaultDeposit,
        _ => Messages.ExportKindVaultWithdrawal,
    };

    // Texto digitado pela pessoa: começando com = + - @ (ou tab e retorno), o Excel o executaria como
    // fórmula (injeção de fórmula). O apóstrofo na frente faz o Excel tratá-lo como texto.
    internal static string Text(string value) =>
        value.Length > 0 && value[0] is '=' or '+' or '-' or '@' or '\t' or '\r' ? "'" + value : value;

    // Entre aspas quando tem o separador, aspas ou quebra de linha (RFC 4180).
    private static string Quote(string value, char separator) =>
        value.IndexOfAny([separator, '"', '\n', '\r']) >= 0 ? "\"" + value.Replace("\"", "\"\"") + "\"" : value;
}

public record ExportData(
    string Format, int Version, DateTime ExportedAt, ExportAccount Account,
    IReadOnlyList<ExportCategory> Categories, IReadOnlyList<ExportVault> Vaults,
    IReadOnlyList<ExportTransaction> Transactions, IReadOnlyList<ExportBudget> Budgets,
    IReadOnlyList<ExportRecurrence> Recurrences, IReadOnlyList<ExportInstallment> Installments,
    IReadOnlyList<ExportCategoryRule> CategoryRules);

public record ExportAccount(string Name, string Email, DateTime CreatedAt, bool HasPassword, bool GoogleLinked);
public record ExportCategory(string Name, string? Color, string? Icon);
public record ExportVault(string Name, decimal? Goal, decimal Balance, DateTime CreatedAt);
// Kind: income, expense, vault-deposit ou vault-withdrawal. Amount com o sinal da conta.
public record ExportTransaction(
    DateOnly Date, string Description, decimal Amount, string Kind, string? Category, string? Vault,
    bool Recurring, bool Installment, bool Imported);
public record ExportBudget(string Category, decimal MonthlyLimit);
public record ExportRecurrence(
    string Description, decimal Amount, string? Category, DateOnly StartDate, int DayOfMonth,
    DateOnly? EndDate, DateOnly NextDate, bool Paused);
public record ExportInstallment(string Description, decimal Total, int Count, DateOnly FirstDate, string? Category);
public record ExportCategoryRule(string Pattern, string Category);
