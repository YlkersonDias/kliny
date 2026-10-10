using Backend.DTOs.Auth;

namespace Backend.Services;

public interface IAuthService
{
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
    /// Conta com senha confirma com a senha; conta só do Google, com um comprovante novo da mesma
    /// conta do Google. As falhas contam no bloqueio por e-mail do login (S.1).
    /// </summary>
    /// <exception cref="Exceptions.BusinessRuleException">Senha ou comprovante ausente ou incorreto.</exception>
    /// <exception cref="Exceptions.TooManyRequestsException">E-mail bloqueado por falhas seguidas.</exception>
    Task DeleteAccountAsync(int userId, string? password, string? googleCredential);

    /// <summary>
    /// Login com o Google: entra pela conta vinculada; senão, só com e-mail em que o Google é a
    /// autoridade, vincula a conta com esse e-mail ou cria uma nova, sem senha.
    /// </summary>
    /// <returns>A resposta com o token, ou null se não for possível entrar (sempre a mesma recusa).</returns>
    Task<AuthResponse?> GoogleSignInAsync(string credential);

    /// <exception cref="Exceptions.BusinessRuleException">Comprovante inválido.</exception>
    /// <exception cref="Exceptions.ConflictException">Conta do Google já vinculada a outra conta, ou esta já tem outra.</exception>
    Task<UserResponse> LinkGoogleAsync(int userId, string credential);

    /// <exception cref="Exceptions.BusinessRuleException">A conta não tem senha.</exception>
    Task<UserResponse> UnlinkGoogleAsync(int userId);
}
