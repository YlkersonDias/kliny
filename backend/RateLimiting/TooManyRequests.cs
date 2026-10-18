using System.Globalization;
using Kliny.Api.Resources;

namespace Kliny.Api.RateLimiting;

public static class TooManyRequests
{
    // Arredondando para cima: "30 segundos" vira "1 minuto", nunca "0 minutos".
    public static string Message(TimeSpan retryAfter)
    {
        var minutes = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalMinutes));
        return minutes == 1
            ? Messages.TooManyAttemptsOneMinute
            : string.Format(Messages.TooManyAttemptsMinutes, minutes);
    }

    public static void SetRetryAfter(HttpResponse response, TimeSpan retryAfter)
    {
        var seconds = Math.Max(1, (int)Math.Ceiling(retryAfter.TotalSeconds));
        response.Headers.RetryAfter = seconds.ToString(CultureInfo.InvariantCulture);
    }
}
