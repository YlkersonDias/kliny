using Kliny.Api.Models;

namespace Kliny.Api.Services;

public interface ITokenService
{
    (string Token, DateTime ExpiresAt) CreateToken(User user);
}
