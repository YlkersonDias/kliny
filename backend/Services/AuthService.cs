using Backend.Data;
using Backend.DTOs.Auth;
using Backend.Models;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;

namespace Backend.Services;

public class AuthService(AppDbContext db, ITokenService tokenService) : IAuthService
{
    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        var email = NormalizeEmail(request.Email);

        if (await db.Users.AnyAsync(u => u.Email == email))
            throw new EmailAlreadyInUseException();

        var user = new User
        {
            Name = request.Name.Trim(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
        };

        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync();
        }
        // Dois cadastros simultâneos com o mesmo e-mail passam pela checagem acima;
        // o índice único barra o segundo.
        catch (DbUpdateException ex) when (ex.InnerException is MySqlException { ErrorCode: MySqlErrorCode.DuplicateKeyEntry })
        {
            throw new EmailAlreadyInUseException();
        }

        return BuildResponse(user);
    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        var email = NormalizeEmail(request.Email);
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Email == email);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return null;

        return BuildResponse(user);
    }

    public async Task<UserResponse?> GetUserAsync(int userId)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
        return user is null ? null : UserResponse.FromUser(user);
    }

    private AuthResponse BuildResponse(User user)
    {
        var (token, expiresAt) = tokenService.CreateToken(user);
        return new AuthResponse(token, expiresAt, UserResponse.FromUser(user));
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
