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
}
