using Backend.DTOs.Auth;

namespace Backend.Services;

public interface IAuthService
{
    /// <exception cref="EmailAlreadyInUseException">Já existe usuário com o e-mail informado.</exception>
    Task<AuthResponse> RegisterAsync(RegisterRequest request);

    /// <returns>A resposta com o token, ou null se o e-mail ou a senha estiverem errados.</returns>
    Task<AuthResponse?> LoginAsync(LoginRequest request);

    Task<UserResponse?> GetUserAsync(int userId);
}
