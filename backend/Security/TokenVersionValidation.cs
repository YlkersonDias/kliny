using Backend.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

namespace Backend.Security;

// Revogação de token (S.5). O JWT leva a versão de token do usuário (claim "tv"); a cada
// requisição, a versão é conferida com a gravada no banco. "Sair de todos os dispositivos"
// incrementa a versão, e todo token emitido antes passa a responder 401 na hora.
// Sem cache de propósito: com cache, um token revogado ainda valeria até o cache vencer.
public static class TokenVersionValidation
{
    public const string ClaimType = "tv";

    public static async Task ValidateAsync(TokenValidatedContext context)
    {
        var principal = context.Principal;
        if (!int.TryParse(principal?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value, out var userId)
            || !int.TryParse(principal.FindFirst(ClaimType)?.Value, out var tokenVersion))
        {
            // Token sem a versão (emitido antes da S.5) ou malformado.
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
