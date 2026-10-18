using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Kliny.Api.Extensions;

public static class ClaimsPrincipalExtensions
{
    // O Program.cs desliga o MapInboundClaims, então o Id chega como "sub".
    public static int GetUserId(this ClaimsPrincipal principal)
    {
        var value = principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return int.TryParse(value, out var id)
            ? id
            : throw new InvalidOperationException("Token sem o Id do usuário.");
    }
}
