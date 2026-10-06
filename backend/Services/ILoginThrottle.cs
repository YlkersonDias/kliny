namespace Backend.Services;

// Falhas de login por e-mail. O e-mail chega já normalizado (sem espaços, minúsculo).
public interface ILoginThrottle
{
    /// <returns>Quanto falta para o e-mail ser liberado, ou null se ele não está bloqueado.</returns>
    TimeSpan? GetLockout(string email);

    void RegisterFailure(string email);

    void Reset(string email);
}
