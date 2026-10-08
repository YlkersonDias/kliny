namespace Backend.Security;

// Cabeçalhos de segurança em toda resposta da API (S.4), inclusive 401, 404, 429 e erros.
// Aplicados no OnStarting, logo antes de a resposta sair: o UseExceptionHandler limpa os
// cabeçalhos ao tratar uma exceção, e assim eles voltam mesmo nesse caso.
public static class SecurityHeaders
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) =>
        app.Use((context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                // Dados financeiros: nada fica no cache do navegador nem de um proxy (regra 14).
                headers.CacheControl = "no-store";
                // O navegador não "adivinha" que um JSON é HTML ou script.
                headers.XContentTypeOptions = "nosniff";
                headers["Referrer-Policy"] = "no-referrer";
                // A API só devolve JSON: nada nela carrega recursos nem pode ser embutido.
                headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
                headers.XFrameOptions = "DENY";
                // Outro site não consegue embutir as respostas (img, script...).
                headers["Cross-Origin-Resource-Policy"] = "same-origin";
                return Task.CompletedTask;
            });
            return next(context);
        });
}
