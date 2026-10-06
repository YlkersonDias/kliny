using System.Threading.RateLimiting;
using Backend.Options;
using Backend.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Backend.RateLimiting;

// Limite por IP no login e no cadastro (AddRateLimiter nativo). O limite por e-mail do login
// fica no LoginThrottle, porque o rate limiter decide antes de ler o corpo da requisição.
public static class RateLimitingSetup
{
    public const string LoginPolicy = "login";
    public const string RegisterPolicy = "register";

    // A janela deslizante anda em 6 pedaços: na de 1 minuto, a cada 10 segundos.
    private const int SegmentsPerWindow = 6;

    public static IServiceCollection AddAppRateLimiting(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<RateLimitOptions>()
            .Bind(configuration.GetSection(RateLimitOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.TryAddSingleton(TimeProvider.System);
        // Singleton: a contagem de falhas precisa durar entre as requisições.
        services.AddSingleton<ILoginThrottle, LoginThrottle>();

        services.AddRateLimiter(options =>
        {
            options.AddPolicy(LoginPolicy, context => PerIp(context, limits => limits.LoginPerIp));
            options.AddPolicy(RegisterPolicy, context => PerIp(context, limits => limits.RegisterPerIp));
            options.OnRejected = OnRejectedAsync;
        });

        return services;
    }

    private static RateLimitPartition<string> PerIp(HttpContext context, Func<RateLimitOptions, SlidingWindowLimit> select)
    {
        var limit = Limit(context, select);
        return RateLimitPartition.GetSlidingWindowLimiter(
            ClientIp.PartitionKey(context.Connection.RemoteIpAddress),
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = limit.PermitLimit,
                Window = limit.Window,
                SegmentsPerWindow = SegmentsPerWindow,
                // Acima do limite, recusa na hora, sem fila.
                QueueLimit = 0,
            });
    }

    private static SlidingWindowLimit Limit(HttpContext context, Func<RateLimitOptions, SlidingWindowLimit> select) =>
        select(context.RequestServices.GetRequiredService<IOptions<RateLimitOptions>>().Value);

    // 429 em ProblemDetails, como os outros erros, com a mensagem no idioma da requisição
    // (o UseRateLimiter vem depois do UseRequestLocalization).
    private static async ValueTask OnRejectedAsync(OnRejectedContext rejected, CancellationToken cancellationToken)
    {
        var context = rejected.HttpContext;
        var policy = context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
        // A janela inteira: é quando, com certeza, uma tentativa volta a ser aceita.
        var retryAfter = policy == RegisterPolicy
            ? Limit(context, limits => limits.RegisterPerIp).Window
            : Limit(context, limits => limits.LoginPerIp).Window;

        context.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        TooManyRequests.SetRetryAfter(context.Response, retryAfter);

        var problemDetails = context.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problemDetails.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails =
            {
                Status = StatusCodes.Status429TooManyRequests,
                Detail = TooManyRequests.Message(retryAfter),
            },
        });
    }
}
