namespace Backend.DTOs.Auth;

public record AuthResponse(string Token, DateTime ExpiresAt, UserResponse User);
