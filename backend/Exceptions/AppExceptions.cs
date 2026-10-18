namespace Backend.Exceptions;

// O ApiExceptionHandler converte cada uma no status HTTP; a mensagem vai para o "detail".

/// <summary>Registro inexistente ou de outro usuário (404).</summary>
public class NotFoundException(string message) : Exception(message);

/// <summary>Conflito com o estado atual, como um valor único repetido (409).</summary>
public class ConflictException(string message) : Exception(message);

/// <summary>Pedido bem formado, mas contraditório, como uma Idempotency-Key reaproveitada (422).</summary>
public class UnprocessableException(string message) : Exception(message);

/// <summary>Dados válidos no formato, mas que ferem uma regra de negócio (400).</summary>
public class BusinessRuleException(string message) : Exception(message);

/// <summary>Tentativas demais; vira 429 com o cabeçalho Retry-After.</summary>
public class TooManyRequestsException(TimeSpan retryAfter)
    : Exception(Backend.RateLimiting.TooManyRequests.Message(retryAfter))
{
    public TimeSpan RetryAfter { get; } = retryAfter;
}
