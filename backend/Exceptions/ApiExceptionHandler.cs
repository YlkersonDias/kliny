using Kliny.Api.RateLimiting;
using Microsoft.AspNetCore.Diagnostics;

namespace Kliny.Api.Exceptions;

public class ApiExceptionHandler(IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var status = exception switch
        {
            NotFoundException => StatusCodes.Status404NotFound,
            ConflictException => StatusCodes.Status409Conflict,
            UnprocessableException => StatusCodes.Status422UnprocessableEntity,
            BusinessRuleException => StatusCodes.Status400BadRequest,
            TooManyRequestsException => StatusCodes.Status429TooManyRequests,
            _ => (int?)null,
        };

        // Outras exceções seguem para o tratamento padrão (500).
        if (status is null)
            return false;

        httpContext.Response.StatusCode = status.Value;
        if (exception is TooManyRequestsException tooMany)
            TooManyRequests.SetRetryAfter(httpContext.Response, tooMany.RetryAfter);
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = { Status = status, Detail = exception.Message },
        });
    }
}
