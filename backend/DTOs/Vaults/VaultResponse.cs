namespace Kliny.Api.DTOs.Vaults;

// Balance é calculado a partir das movimentações do cofre; não é armazenado.
public record VaultResponse(int Id, string Name, decimal? Goal, decimal Balance, DateTime CreatedAt);
