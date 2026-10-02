using Backend.Models;

namespace Backend.DTOs.Auth;

public record UserResponse(int Id, string Name, string Email, DateTime CreatedAt)
{
    public static UserResponse FromUser(User user) =>
        new(user.Id, user.Name, user.Email, user.CreatedAt);
}
