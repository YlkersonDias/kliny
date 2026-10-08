using Microsoft.IdentityModel.JsonWebTokens;

namespace Backend.Data;

// Usuário logado para o filtro global do AppDbContext (S.6b).
public interface ICurrentUser
{
    // Null sem usuário autenticado: o filtro global não devolve nada.
    int? UserId { get; }
}

// O Id vem do token ("sub"), lido a cada consulta da requisição atual.
public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public int? UserId =>
        accessor.HttpContext?.User is { Identity.IsAuthenticated: true } user
        && int.TryParse(user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id)
            ? id
            : null;
}

// Fora de uma requisição (testes, ferramentas): ninguém logado, então nada de categorias,
// cofres ou movimentações aparece. Falhar fechado é o padrão seguro.
public sealed class NoCurrentUser : ICurrentUser
{
    public static readonly NoCurrentUser Instance = new();

    public int? UserId => null;
}
