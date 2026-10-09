using Backend.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using MySqlConnector;

namespace Backend.Tests;

// Regra 8 de "Segurança (obrigatória)": toda migration precisa de Down testado. Num banco
// descartável, sobe as migrations uma a uma guardando o esquema depois de cada uma, desce uma a
// uma (com dados nas tabelas) conferindo que o esquema volta ao de antes, e sobe tudo de novo.
// Também confere que o modelo do EF não tem mudança sem migration.
public class MigrationsTests : IAsyncLifetime
{
    private static readonly MySqlServerVersion ServerVersion = new(new Version(8, 4, 0));

    private string? _connectionString;
    private string _database = "";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask InitializeAsync()
    {
        var server = Environment.GetEnvironmentVariable(MySqlApi.ServerVariable);
        if (string.IsNullOrWhiteSpace(server))
        {
            if (Environment.GetEnvironmentVariable("CI") == "true")
                throw new InvalidOperationException($"{MySqlApi.ServerVariable} não definida no CI: os testes de migration não rodariam.");
            return ValueTask.CompletedTask;
        }

        _database = $"kliny_mig_{Guid.NewGuid():N}";
        _connectionString = new MySqlConnectionStringBuilder(server) { Database = _database }.ConnectionString;
        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        if (_connectionString is null)
            return;
        await using var db = Context();
        await db.Database.EnsureDeletedAsync();
    }

    private AppDbContext Context() =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseMySql(_connectionString, ServerVersion).Options);

    [Fact]
    public async Task Cada_migration_desce_e_sobe_sem_mudar_o_esquema()
    {
        Assert.SkipWhen(_connectionString is null, $"Sem MySQL de teste ({MySqlApi.ServerVariable}): roda no CI.");

        await using var db = Context();
        var migrator = db.GetService<IMigrator>();
        var migrations = db.Database.GetMigrations().ToList();
        Assert.NotEmpty(migrations);

        // Esquema antes de qualquer migration (o banco ainda nem existe) e depois de cada uma.
        var schemas = new List<string> { await SchemaAsync() };
        foreach (var migration in migrations)
        {
            await migrator.MigrateAsync(migration, Ct);
            schemas.Add(await SchemaAsync());
        }

        Assert.False(db.Database.HasPendingModelChanges(), "O modelo do EF tem mudança sem migration.");
        await InsertSampleDataAsync();

        // Desce uma por uma, com dados, e confere o esquema anterior a cada passo.
        for (var i = migrations.Count - 1; i >= 0; i--)
        {
            var target = i == 0 ? Migration.InitialDatabase : migrations[i - 1];
            await migrator.MigrateAsync(target, Ct);
            Assert.True(schemas[i] == await SchemaAsync(), $"O Down de {migrations[i]} não voltou ao esquema anterior.");
        }

        await migrator.MigrateAsync(null, Ct);
        Assert.Equal(schemas[^1], await SchemaAsync());
        Assert.Equal(migrations, await db.Database.GetAppliedMigrationsAsync(Ct));
    }

    // Uma linha em cada tabela, para os Down rodarem com dados (como num banco de verdade).
    private async Task InsertSampleDataAsync()
    {
        // AllowUserVariables: sem ele, o MySqlConnector leria @user como parâmetro.
        var connectionString = new MySqlConnectionStringBuilder(_connectionString!) { AllowUserVariables = true }.ConnectionString;
        await using var connection = new MySqlConnection(connectionString);
        await connection.OpenAsync(Ct);
        await using var command = new MySqlCommand("""
            INSERT INTO Users (Name, Email, PasswordHash, CreatedAt) VALUES ('Ana', 'ana@kliny.test', 'hash', UTC_TIMESTAMP(6));
            SET @user = LAST_INSERT_ID();
            INSERT INTO Categories (UserId, Name) VALUES (@user, 'Mercado');
            SET @category = LAST_INSERT_ID();
            INSERT INTO Vaults (UserId, Name, Goal, CreatedAt) VALUES (@user, 'Reserva', 500, UTC_TIMESTAMP(6));
            SET @vault = LAST_INSERT_ID();
            INSERT INTO Transactions (UserId, Description, Amount, Date, CategoryId, VaultId)
            VALUES (@user, 'Salário', 1000, '2021-03-01', @category, NULL),
                   (@user, 'Depósito no cofre Reserva', -100, '2021-03-02', NULL, @vault);
            INSERT INTO Budgets (UserId, CategoryId, Amount) VALUES (@user, @category, 800);
            INSERT INTO Recurrences (UserId, Description, Amount, CategoryId, StartDate, DayOfMonth, NextDate, Paused, CreatedAt)
            VALUES (@user, 'Aluguel', -1500, @category, '2021-03-05', 5, '2021-04-05', 0, UTC_TIMESTAMP(6));
            INSERT INTO Transactions (UserId, Description, Amount, Date, CategoryId, VaultId, RecurrenceId)
            VALUES (@user, 'Aluguel', -1500, '2021-03-05', @category, NULL, LAST_INSERT_ID());
            """, connection);
        await command.ExecuteNonQueryAsync(Ct);
    }

    // Colunas, índices e chaves estrangeiras do banco de teste, em texto comparável. Só consultas
    // parametrizadas ao information_schema; o histórico de migrations fica de fora.
    private async Task<string> SchemaAsync()
    {
        var server = new MySqlConnectionStringBuilder(_connectionString!) { Database = "" }.ConnectionString;
        await using var connection = new MySqlConnection(server);
        await connection.OpenAsync(Ct);

        var lines = new List<string>();
        await ReadAsync(connection, lines, """
            SELECT CONCAT_WS('|', 'col', TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, COLUMN_TYPE, IS_NULLABLE,
                             IFNULL(COLUMN_DEFAULT, '<null>'), EXTRA, IFNULL(COLLATION_NAME, ''))
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = @db AND TABLE_NAME <> '__EFMigrationsHistory'
            ORDER BY TABLE_NAME, ORDINAL_POSITION
            """);
        await ReadAsync(connection, lines, """
            SELECT CONCAT_WS('|', 'idx', TABLE_NAME, INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME)
            FROM information_schema.STATISTICS
            WHERE TABLE_SCHEMA = @db AND TABLE_NAME <> '__EFMigrationsHistory'
            ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
            """);
        await ReadAsync(connection, lines, """
            SELECT CONCAT_WS('|', 'fk', k.TABLE_NAME, k.CONSTRAINT_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME,
                             k.REFERENCED_COLUMN_NAME, r.UPDATE_RULE, r.DELETE_RULE)
            FROM information_schema.KEY_COLUMN_USAGE k
            JOIN information_schema.REFERENTIAL_CONSTRAINTS r
              ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
            WHERE k.TABLE_SCHEMA = @db
            ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION
            """);
        return string.Join('\n', lines);
    }

    private async Task ReadAsync(MySqlConnection connection, List<string> lines, string sql)
    {
        await using var command = new MySqlCommand(sql, connection);
        command.Parameters.AddWithValue("@db", _database);
        await using var reader = await command.ExecuteReaderAsync(Ct);
        while (await reader.ReadAsync(Ct))
            lines.Add(reader.GetString(0));
    }
}
