using Kliny.Api.DTOs.Auth;

namespace Kliny.Api.Services;

public interface IAuthService
{
    /// <returns>A resposta com o token, ou null se o e-mail ou a senha estiverem errados.</returns>
    /// <exception cref="Exceptions.TooManyRequestsException">E-mail bloqueado por falhas seguidas.</exception>
    Task<AuthResponse?> LoginAsync(LoginRequest request);

    Task<UserResponse?> GetUserAsync(int userId);

    /// <summary>"Sair de todos os dispositivos": todo token emitido antes passa a responder 401.</summary>
    Task RevokeAllTokensAsync(int userId);

    /// <summary>Exclui a conta e todos os dados. Confirma com a senha ou, sem senha, com o Google.</summary>
    /// <exception cref="Exceptions.BusinessRuleException">Senha ou comprovante ausente ou incorreto.</exception>
    /// <exception cref="Exceptions.TooManyRequestsException">E-mail bloqueado por falhas seguidas.</exception>
    Task DeleteAccountAsync(int userId, string? password, string? googleCredential);

    /// <summary>Entra pela conta vinculada ou, com e-mail em que o Google é autoridade, vincula ou cria.</summary>
    /// <returns>A resposta com o token, ou null se não for possível entrar (sempre a mesma recusa).</returns>
    Task<AuthResponse?> GoogleSignInAsync(string credential);

    /// <exception cref="Exceptions.BusinessRuleException">Comprovante inválido.</exception>
    /// <exception cref="Exceptions.ConflictException">Conta do Google já vinculada a outra conta, ou esta já tem outra.</exception>
    Task<UserResponse> LinkGoogleAsync(int userId, string credential);

    /// <exception cref="Exceptions.BusinessRuleException">A conta não tem senha.</exception>
    Task<UserResponse> UnlinkGoogleAsync(int userId);
}
