using Backend.DTOs.Auth;

namespace Backend.Services;

public interface IAuthService
{
    /// <exception cref="Exceptions.ConflictException">Já existe usuário com o e-mail informado.</exception>
    Task<AuthResponse> RegisterAsync(RegisterRequest request);

    /// <returns>A resposta com o token, ou null se o e-mail ou a senha estiverem errados.</returns>
    /// <exception cref="Exceptions.TooManyRequestsException">E-mail bloqueado por falhas seguidas.</exception>
    Task<AuthResponse?> LoginAsync(LoginRequest request);

    Task<UserResponse?> GetUserAsync(int userId);

    /// <summary>
    /// "Sair de todos os dispositivos": incrementa a versão de token do usuário, e todo token
    /// emitido antes (em qualquer aparelho) passa a responder 401.
    /// </summary>
    Task RevokeAllTokensAsync(int userId);

    /// <summary>
    /// Exclui a conta e todos os dados do usuário (movimentações, cofres e categorias). Irreversível.
    /// Exige a senha atual; as falhas contam no bloqueio por e-mail do login (S.1).
    /// </summary>
    /// <exception cref="Exceptions.BusinessRuleException">Senha incorreta.</exception>
    /// <exception cref="Exceptions.TooManyRequestsException">E-mail bloqueado por falhas seguidas.</exception>
    Task DeleteAccountAsync(int userId, string password);
}
