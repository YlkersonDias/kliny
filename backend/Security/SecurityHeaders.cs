namespace Kliny.Api.Security;

// Aplicados no OnStarting: o UseExceptionHandler limpa os cabeçalhos ao tratar uma exceção.
public static class SecurityHeaders
{
    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) =>
        app.Use((context, next) =>
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;
                headers.CacheControl = "no-store";
                headers.XContentTypeOptions = "nosniff";
                headers["Referrer-Policy"] = "no-referrer";
                // A API só devolve JSON: nada nela carrega recursos nem pode ser embutido.
                headers.ContentSecurityPolicy = "default-src 'none'; frame-ancestors 'none'";
                headers.XFrameOptions = "DENY";
                headers["Cross-Origin-Resource-Policy"] = "same-origin";
                return Task.CompletedTask;
            });
            return next(context);
        });
}
