using Backend.DTOs.Auth;
using Backend.Extensions;
using Backend.RateLimiting;
using Backend.Resources;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Backend.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(IAuthService authService) : ControllerBase
{
    // Público: as únicas rotas sem login (o Program.cs exige login em todo o resto).
    [AllowAnonymous]
    [HttpPost("register")]
    [EnableRateLimiting(RateLimitingSetup.RegisterPolicy)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var response = await authService.RegisterAsync(request);
        return CreatedAtAction(nameof(Me), response);
    }

    // Por IP aqui; por e-mail no AuthService (LoginThrottle).
    [AllowAnonymous]
    [HttpPost("login")]
    [EnableRateLimiting(RateLimitingSetup.LoginPolicy)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var response = await authService.LoginAsync(request);
        return response is null
            ? Problem(Messages.InvalidCredentials, statusCode: StatusCodes.Status401Unauthorized)
            : Ok(response);
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me()
    {
        // Token válido de um usuário que não existe mais é tratado como não autenticado.
        var user = await authService.GetUserAsync(User.GetUserId());
        return user is null ? Unauthorized() : Ok(user);
    }

    // Exclui a conta e todos os dados do usuário, de forma irreversível. Exige a senha atual e tem o
    // mesmo limite por IP do login. Depois disso, o token (e qualquer outro do usuário) responde 401.
    [Authorize]
    [HttpPost("delete-account")]
    [EnableRateLimiting(RateLimitingSetup.LoginPolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> DeleteAccount(DeleteAccountRequest request)
    {
        await authService.DeleteAccountAsync(User.GetUserId(), request.Password);
        return NoContent();
    }

    // S.5: invalida todos os tokens do usuário, inclusive o desta requisição.
    [Authorize]
    [HttpPost("logout-all")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> LogoutAll()
    {
        await authService.RevokeAllTokensAsync(User.GetUserId());
        return NoContent();
    }
}
