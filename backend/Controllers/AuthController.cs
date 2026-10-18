using Kliny.Api.DTOs.Auth;
using Kliny.Api.Extensions;
using Kliny.Api.RateLimiting;
using Kliny.Api.Resources;
using Kliny.Api.Security;
using Kliny.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Kliny.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    IAuthService authService, IPasswordResetService passwordResetService, IRegistrationService registrationService,
    IOptions<GoogleOptions> googleOptions) : ControllerBase
{
    // Responde sempre 202, tenha o e-mail conta ou não: a conta só nasce pelo link do e-mail.
    [AllowAnonymous]
    [HttpPost("register")]
    [EnableRateLimiting(RateLimitingSetup.RegisterPolicy)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        await registrationService.RequestAsync(request.Name, request.Email);
        return Accepted();
    }

    [AllowAnonymous]
    [HttpPost("register/complete")]
    [EnableRateLimiting(RateLimitingSetup.PasswordResetPolicy)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> CompleteRegistration(CompleteRegistrationRequest request)
    {
        var response = await registrationService.CompleteAsync(request.Token, request.Password);
        return CreatedAtAction(nameof(Me), response);
    }

    // Limite por IP aqui; por e-mail no AuthService.
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

    // Responde sempre 204, exista a conta ou não.
    [AllowAnonymous]
    [HttpPost("forgot-password")]
    [EnableRateLimiting(RateLimitingSetup.PasswordResetPolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        await passwordResetService.RequestAsync(request.Email);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    [EnableRateLimiting(RateLimitingSetup.PasswordResetPolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequest request)
    {
        await passwordResetService.ResetAsync(request.Token, request.Password);
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("google")]
    [EnableRateLimiting(RateLimitingSetup.LoginPolicy)]
    [ProducesResponseType<AuthResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Google(GoogleCredentialRequest request)
    {
        if (!googleOptions.Value.Enabled)
            return NotFound();
        var response = await authService.GoogleSignInAsync(request.Credential);
        return response is null
            ? Problem(Messages.GoogleSignInFailed, statusCode: StatusCodes.Status401Unauthorized)
            : Ok(response);
    }

    [Authorize]
    [HttpPost("google/link")]
    [EnableRateLimiting(RateLimitingSetup.LoginPolicy)]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> LinkGoogle(GoogleCredentialRequest request)
    {
        if (!googleOptions.Value.Enabled)
            return NotFound();
        return Ok(await authService.LinkGoogleAsync(User.GetUserId(), request.Credential));
    }

    [Authorize]
    [HttpPost("google/unlink")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UnlinkGoogle() =>
        Ok(await authService.UnlinkGoogleAsync(User.GetUserId()));

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me()
    {
        var user = await authService.GetUserAsync(User.GetUserId());
        return user is null ? Unauthorized() : Ok(user);
    }

    // Exige a senha atual: um token roubado sozinho não apaga a conta.
    [Authorize]
    [HttpPost("delete-account")]
    [EnableRateLimiting(RateLimitingSetup.LoginPolicy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> DeleteAccount(DeleteAccountRequest request)
    {
        await authService.DeleteAccountAsync(User.GetUserId(), request.Password, request.GoogleCredential);
        return NoContent();
    }

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
