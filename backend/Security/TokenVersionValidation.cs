using Kliny.Api.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Kliny.Api.Security;

// A versão de token (claim "tv") é conferida com a do banco a cada requisição. Sem cache, de
// propósito: com cache, um token revogado ainda valeria até o cache vencer.
public static class TokenVersionValidation
{
    public const string ClaimType = "tv";

    public static async Task ValidateAsync(TokenValidatedContext context)
    {
        var principal = context.Principal;
        if (!int.TryParse(principal?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var userId)
            || !int.TryParse(principal.FindFirst(ClaimType)?.Value, out var tokenVersion))
        {
            context.Fail("Token sem versão.");
            return;
        }

        var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var current = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => (int?)u.TokenVersion)
            .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

        // Usuário apagado ou token revogado.
        if (current != tokenVersion)
            context.Fail("Token revogado.");
    }
}
