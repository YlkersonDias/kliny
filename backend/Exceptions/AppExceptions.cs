namespace Backend.Exceptions;

// Exceções de domínio lançadas pelos services. O ApiExceptionHandler converte cada uma
// no status HTTP correspondente; a mensagem vai para o "detail" do ProblemDetails.

/// <summary>Registro inexistente ou de outro usuário (404).</summary>
public class NotFoundException(string message) : Exception(message);

/// <summary>Conflito com o estado atual, como um valor único repetido (409).</summary>
public class ConflictException(string message) : Exception(message);

/// <summary>Pedido bem formado, mas contraditório: repetir não adianta (422). Ex.: Idempotency-Key reaproveitada com outro conteúdo.</summary>
public class UnprocessableException(string message) : Exception(message);

/// <summary>Dados válidos no formato, mas que ferem uma regra de negócio (400).</summary>
public class BusinessRuleException(string message) : Exception(message);

/// <summary>Tentativas demais; vira 429 com o cabeçalho Retry-After.</summary>
public class TooManyRequestsException(TimeSpan retryAfter)
    : Exception(Backend.RateLimiting.TooManyRequests.Message(retryAfter))
{
    public TimeSpan RetryAfter { get; } = retryAfter;
}
