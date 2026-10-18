using System.Threading.RateLimiting;
using Kliny.Api.Options;
using Kliny.Api.Services;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Kliny.Api.RateLimiting;

// O limite por e-mail do login fica no LoginThrottle: o rate limiter decide antes de ler o corpo.
public static class RateLimitingSetup
{
    public const string LoginPolicy = "login";
    public const string RegisterPolicy = "register";
    public const string PasswordResetPolicy = "password-reset";
    public const string ExportPolicy = "export";

    // Na janela de 1 minuto, a cada 10 segundos.
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
            options.AddPolicy(PasswordResetPolicy, context => PerIp(context, limits => limits.PasswordResetPerIp));
            options.AddPolicy(ExportPolicy, context => PerIp(context, limits => limits.ExportPerIp));
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
                QueueLimit = 0,
            });
    }

    private static SlidingWindowLimit Limit(HttpContext context, Func<RateLimitOptions, SlidingWindowLimit> select) =>
        select(context.RequestServices.GetRequiredService<IOptions<RateLimitOptions>>().Value);

    // A mensagem sai no idioma da requisição: o UseRateLimiter vem depois do UseRequestLocalization.
    private static async ValueTask OnRejectedAsync(OnRejectedContext rejected, CancellationToken cancellationToken)
    {
        var context = rejected.HttpContext;
        var policy = context.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
        // A janela inteira: é quando, com certeza, uma tentativa volta a ser aceita.
        var retryAfter = policy switch
        {
            RegisterPolicy => Limit(context, limits => limits.RegisterPerIp).Window,
            PasswordResetPolicy => Limit(context, limits => limits.PasswordResetPerIp).Window,
            ExportPolicy => Limit(context, limits => limits.ExportPerIp).Window,
            _ => Limit(context, limits => limits.LoginPerIp).Window,
        };

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
