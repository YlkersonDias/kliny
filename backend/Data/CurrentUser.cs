using Microsoft.IdentityModel.JsonWebTokens;

namespace Backend.Data;

public interface ICurrentUser
{
    // Null sem usuário autenticado: o filtro global não devolve nada.
    int? UserId { get; }
}

public sealed class HttpCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public int? UserId =>
        accessor.HttpContext?.User is { Identity.IsAuthenticated: true } user
        && int.TryParse(user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var id)
            ? id
            : null;
}

// Fora de uma requisição, ninguém está logado e nada aparece: falhar fechado é o padrão seguro.
public sealed class NoCurrentUser : ICurrentUser
{
    public static readonly NoCurrentUser Instance = new();

    public int? UserId => null;
}
