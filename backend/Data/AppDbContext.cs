using Backend.DTOs.Categories;
using Backend.Models;
using Microsoft.EntityFrameworkCore;

namespace Backend.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options, ICurrentUser currentUser) : DbContext(options)
{
    // Sem usuário logado (testes, ferramentas): o filtro global não devolve nada.
    public AppDbContext(DbContextOptions<AppDbContext> options) : this(options, NoCurrentUser.Instance)
    {
    }

    // Lido pelo filtro global a cada consulta (S.6b). Precisa ser membro do contexto: o EF só
    // reavalia por instância o que é campo ou propriedade do DbContext.
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

    // Filtro global (S.6b, segunda camada da regra 2): categorias, cofres e movimentações só
    // aparecem para o dono, mesmo numa consulta que esqueça o Where(UserId). Os services continuam
    // filtrando também. Users fica de fora: o login e a validação do token precisam achar o usuário
    // antes de saber quem está logado. IgnoreQueryFilters() só com o UserId já filtrado no SQL.
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
            // A collation do banco ignora maiúsculas e acentos: "Mercado" e "mercado" contam como iguais.
            entity.HasIndex(c => new { c.UserId, c.Name }).IsUnique();
            entity.HasQueryFilter(c => c.UserId == CurrentUserId);
            entity.HasOne(c => c.User)
                .WithMany(u => u.Categories)
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Orçamento (8.2): um por categoria de cada usuário. Apagar o usuário ou a categoria apaga o orçamento.
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

        // Recorrência (8.5a). Apagar o usuário apaga as regras; apagar a categoria deixa a regra sem
        // categoria. A NextDate é o controle de concorrência da sincronização.
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

        // Compra parcelada (8.5b). Apagar o usuário apaga as compras; apagar a categoria deixa a
        // compra sem categoria (as parcelas já ficam sem categoria pela chave delas).
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

        // Link de troca de senha: só o hash do token, único. Sem filtro global por usuário (como Users):
        // quem usa o link não está logado. Apagar o usuário apaga os links.
        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.Property(t => t.TokenHash).HasMaxLength(64).IsFixedLength().IsRequired();
            entity.HasIndex(t => t.TokenHash).IsUnique();
            entity.HasOne(t => t.User)
                .WithMany()
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Cadastro esperando a confirmação do e-mail: só o hash do token, único. Sem filtro global por
        // usuário (ainda não existe usuário) e sem chave para Users. Índice no e-mail para encerrar os
        // pedidos anteriores do mesmo endereço.
        modelBuilder.Entity<PendingRegistration>(entity =>
        {
            entity.Property(p => p.Email).HasMaxLength(255).IsRequired();
            entity.Property(p => p.Name).HasMaxLength(100).IsRequired();
            entity.Property(p => p.TokenHash).HasMaxLength(64).IsFixedLength().IsRequired();
            entity.HasIndex(p => p.TokenHash).IsUnique();
            entity.HasIndex(p => p.Email);
        });

        // Regra de categoria (8.4): um texto por usuário (a collation iguala maiúsculas e acentos).
        // Apagar o usuário ou a categoria apaga a regra.
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
            // Por usuário: a chave de um nunca encontra o lançamento de outro. O MySQL aceita
            // vários NULL num índice único, então as movimentações comuns não são afetadas.
            entity.HasIndex(t => new { t.UserId, t.IdempotencyKey }).IsUnique();
            entity.Property(t => t.ImportKey).HasMaxLength(64);
            entity.HasIndex(t => new { t.UserId, t.ImportKey }).IsUnique();

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

            // Apagar a regra recorrente mantém as movimentações que ela gerou, sem o vínculo.
            entity.HasOne(t => t.Recurrence)
                .WithMany(r => r.Transactions)
                .HasForeignKey(t => t.RecurrenceId)
                .OnDelete(DeleteBehavior.SetNull);

            // Apagar a compra parcelada só com as parcelas futuras mantém as outras, sem o vínculo.
            entity.HasOne(t => t.InstallmentPlan)
                .WithMany(p => p.Transactions)
                .HasForeignKey(t => t.InstallmentPlanId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
