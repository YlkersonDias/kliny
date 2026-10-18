using Kliny.Api.DTOs.Categories;
using Kliny.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Kliny.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser currentUser) : DbContext(options)
{
    // Sem usuário logado, o filtro global não devolve nada.
    public AppDbContext(DbContextOptions<AppDbContext> options) : this(options, NoCurrentUser.Instance)
    {
    }

    // Precisa ser membro do contexto: o EF só reavalia por instância o que pertence ao DbContext.
    private int? CurrentUserId => currentUser.UserId;

    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Budget> Budgets => Set<Budget>();
    public DbSet<Vault> Vaults => Set<Vault>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Recurrence> Recurrences => Set<Recurrence>();
    public DbSet<InstallmentPlan> InstallmentPlans => Set<InstallmentPlan>();
    public DbSet<CategoryRule> CategoryRules => Set<CategoryRule>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<PendingRegistration> PendingRegistrations => Set<PendingRegistration>();

    // datetime(6) não guarda o fuso: todo DateTime é gravado em UTC e lido marcado como UTC.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    private sealed class UtcDateTimeConverter() : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
        value => value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : value,
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc));

    // Filtro global: segunda camada do dono, para uma consulta que esqueça o Where(UserId). Users fica
    // de fora (o login precisa achá-lo antes de saber quem está logado).
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(u => u.Name).HasMaxLength(100).IsRequired();
            entity.Property(u => u.Email).HasMaxLength(255).IsRequired();
            entity.Property(u => u.PasswordHash).HasMaxLength(255);
            entity.Property(u => u.GoogleSubject).HasMaxLength(255);
            entity.HasIndex(u => u.GoogleSubject).IsUnique();
            entity.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.Property(c => c.Name).HasMaxLength(100).IsRequired();
            entity.Property(c => c.Color).HasMaxLength(CategoryAppearance.MaxLength);
            entity.Property(c => c.Icon).HasMaxLength(CategoryAppearance.MaxLength);
            // A collation ignora maiúsculas e acentos: "Mercado" e "mercado" são o mesmo nome.
            entity.HasIndex(c => new { c.UserId, c.Name }).IsUnique();
            entity.HasQueryFilter(c => c.UserId == CurrentUserId);
            entity.HasOne(c => c.User)
                .WithMany(u => u.Categories)
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Budget>(entity =>
        {
            entity.Property(b => b.Amount).HasPrecision(18, 2);
            entity.HasIndex(b => new { b.UserId, b.CategoryId }).IsUnique();
            entity.HasQueryFilter(b => b.UserId == CurrentUserId);
            entity.HasOne(b => b.User)
                .WithMany()
                .HasForeignKey(b => b.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(b => b.Category)
                .WithMany()
                .HasForeignKey(b => b.CategoryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // A NextDate é o controle de concorrência da sincronização.
        modelBuilder.Entity<Recurrence>(entity =>
        {
            entity.Property(r => r.Description).HasMaxLength(255).IsRequired();
            entity.Property(r => r.Amount).HasPrecision(18, 2);
            entity.Property(r => r.NextDate).IsConcurrencyToken();
            entity.HasIndex(r => new { r.UserId, r.NextDate });
            entity.HasQueryFilter(r => r.UserId == CurrentUserId);
            entity.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(r => r.Category)
                .WithMany()
                .HasForeignKey(r => r.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<InstallmentPlan>(entity =>
        {
            entity.Property(p => p.Description).HasMaxLength(245).IsRequired();
            entity.Property(p => p.Total).HasPrecision(18, 2);
            entity.HasIndex(p => new { p.UserId, p.FirstDate });
            entity.HasQueryFilter(p => p.UserId == CurrentUserId);
            entity.HasOne(p => p.User)
                .WithMany()
                .HasForeignKey(p => p.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(p => p.Category)
                .WithMany()
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // Sem filtro global: quem usa o link não está logado. A busca é sempre pelo hash.
        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.Property(t => t.TokenHash).HasMaxLength(64).IsFixedLength().IsRequired();
            entity.HasIndex(t => t.TokenHash).IsUnique();
            entity.HasOne(t => t.User)
                .WithMany()
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Sem filtro global nem ligação com Users: o usuário ainda não existe.
        modelBuilder.Entity<PendingRegistration>(entity =>
        {
            entity.Property(p => p.Email).HasMaxLength(255).IsRequired();
            entity.Property(p => p.Name).HasMaxLength(100).IsRequired();
            entity.Property(p => p.TokenHash).HasMaxLength(64).IsFixedLength().IsRequired();
            entity.HasIndex(p => p.TokenHash).IsUnique();
            entity.HasIndex(p => p.Email);
        });

        modelBuilder.Entity<CategoryRule>(entity =>
        {
            entity.Property(r => r.Pattern).HasMaxLength(100).IsRequired();
            entity.HasIndex(r => new { r.UserId, r.Pattern }).IsUnique();
            entity.HasQueryFilter(r => r.UserId == CurrentUserId);
            entity.HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(r => r.Category)
                .WithMany()
                .HasForeignKey(r => r.CategoryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Vault>(entity =>
        {
            entity.Property(v => v.Name).HasMaxLength(100).IsRequired();
            entity.Property(v => v.Goal).HasPrecision(18, 2);
            entity.HasIndex(v => new { v.UserId, v.Name }).IsUnique();
            entity.HasQueryFilter(v => v.UserId == CurrentUserId);
            entity.HasOne(v => v.User)
                .WithMany(u => u.Vaults)
                .HasForeignKey(v => v.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.Property(t => t.Description).HasMaxLength(255).IsRequired();
            entity.Property(t => t.Amount).HasPrecision(18, 2);
            entity.HasQueryFilter(t => t.UserId == CurrentUserId);
            entity.HasIndex(t => new { t.UserId, t.Date });
            entity.Property(t => t.IdempotencyKey).HasMaxLength(IdempotencyKey.MaxLength);
            // O MySQL aceita vários NULL num índice único: as movimentações comuns não são afetadas.
            entity.HasIndex(t => new { t.UserId, t.IdempotencyKey }).IsUnique();
            entity.Property(t => t.ImportKey).HasMaxLength(64);
            entity.HasIndex(t => new { t.UserId, t.ImportKey }).IsUnique();

            entity.HasOne(t => t.User)
                .WithMany(u => u.Transactions)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(t => t.Category)
                .WithMany(c => c.Transactions)
                .HasForeignKey(t => t.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);

            // Cofre com movimentações não pode ser apagado: o saldo depende delas.
            entity.HasOne(t => t.Vault)
                .WithMany(v => v.Transactions)
                .HasForeignKey(t => t.VaultId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(t => t.Recurrence)
                .WithMany(r => r.Transactions)
                .HasForeignKey(t => t.RecurrenceId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(t => t.InstallmentPlan)
                .WithMany(p => p.Transactions)
                .HasForeignKey(t => t.InstallmentPlanId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
