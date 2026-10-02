using Microsoft.AspNetCore.Diagnostics;

namespace Backend.Exceptions;

public class ApiExceptionHandler(IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var status = exception switch
        {
            NotFoundException => StatusCodes.Status404NotFound,
            ConflictException => StatusCodes.Status409Conflict,
            BusinessRuleException => StatusCodes.Status400BadRequest,
            _ => (int?)null,
        };

        // Outras exceções seguem para o tratamento padrão (500).
        if (status is null)
            return false;

        httpContext.Response.StatusCode = status.Value;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            Exception = exception,
            ProblemDetails = { Status = status, Detail = exception.Message },
        });
    }
}
