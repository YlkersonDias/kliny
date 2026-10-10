using Backend.DTOs.Auth;
using Backend.Extensions;
using Backend.RateLimiting;
using Backend.Resources;
using Backend.Security;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace Backend.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    IAuthService authService, IPasswordResetService passwordResetService, IRegistrationService registrationService,
    IOptions<GoogleOptions> googleOptions) : ControllerBase
{
    // Público: as únicas rotas sem login (o Program.cs exige login em todo o resto).
    // Cadastro: responde sempre 202, tenha o e-mail conta ou não (regra 4). A conta só é criada
    // pelo link do e-mail (register/complete), com a senha escolhida por quem o recebeu.
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

    // Fim do cadastro pelo link: cria a conta e já entra nela. Mesmo limite por IP da recuperação de
    // senha (quem tenta adivinhar tokens).
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

    // "Esqueci minha senha": responde sempre 204, exista a conta ou não (regra 4); o link sai por
    // e-mail em segundo plano. Limite por IP próprio, além do limite por conta no service.
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

    // Troca a senha pelo token do link. Link inválido, vencido ou já usado: 400, sempre a mesma mensagem.
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

    // Login com o Google: o frontend manda o comprovante (ID token) do Google Identity Services.
    // Mesmo limite por IP do login; recusa sempre com a mesma mensagem (regra 4).
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
        await authService.DeleteAccountAsync(User.GetUserId(), request.Password, request.GoogleCredential);
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
