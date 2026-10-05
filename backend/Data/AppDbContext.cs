using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Vault> Vaults => Set<Vault>();
    public DbSet<Transaction> Transactions => Set<Transaction>();

    // O banco guarda os DateTime em UTC, mas a coluna datetime(6) não guarda o fuso: lido de volta,
    // o valor vinha sem fuso e a API o serializava sem "Z", e o navegador o lia como hora local.
    // Aqui todo DateTime é gravado em UTC e lido marcado como UTC. A coluna não muda.
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    private sealed class UtcDateTimeConverter() : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<DateTime, DateTime>(
        value => value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : value,
        value => DateTime.SpecifyKind(value, DateTimeKind.Utc));

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.Property(u => u.Name).HasMaxLength(100).IsRequired();
            entity.Property(u => u.Email).HasMaxLength(255).IsRequired();
            entity.Property(u => u.PasswordHash).HasMaxLength(255).IsRequired();
            entity.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.Property(c => c.Name).HasMaxLength(100).IsRequired();
            // A collation do banco ignora maiúsculas e acentos: "Mercado" e "mercado" contam como iguais.
            entity.HasIndex(c => new { c.UserId, c.Name }).IsUnique();
            entity.HasOne(c => c.User)
                .WithMany(u => u.Categories)
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Vault>(entity =>
        {
            entity.Property(v => v.Name).HasMaxLength(100).IsRequired();
            entity.Property(v => v.Goal).HasPrecision(18, 2);
            entity.HasIndex(v => new { v.UserId, v.Name }).IsUnique();
            entity.HasOne(v => v.User)
                .WithMany(u => u.Vaults)
                .HasForeignKey(v => v.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Transaction>(entity =>
        {
            entity.Property(t => t.Description).HasMaxLength(255).IsRequired();
            entity.Property(t => t.Amount).HasPrecision(18, 2);
            entity.HasIndex(t => new { t.UserId, t.Date });

            entity.HasOne(t => t.User)
                .WithMany(u => u.Transactions)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Apagar uma categoria não apaga as transações; elas ficam sem categoria.
            entity.HasOne(t => t.Category)
                .WithMany(c => c.Transactions)
                .HasForeignKey(t => t.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);

            // Um cofre com movimentações não pode ser apagado, pois o saldo depende delas.
            entity.HasOne(t => t.Vault)
                .WithMany(v => v.Transactions)
                .HasForeignKey(t => t.VaultId)
                .OnDelete(DeleteBehavior.Restrict);
        });
    }
}
