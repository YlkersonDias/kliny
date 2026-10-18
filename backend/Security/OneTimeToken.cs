using System.Security.Cryptography;
using System.Text;

namespace Kliny.Api.Security;

// 256 bits aleatórios em Base64 URL. O banco guarda só o SHA-256: quem lê o banco ou um backup
// não consegue usar o link.
public static class OneTimeToken
{
    public static (string Token, string Hash) Create()
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return (token, Hash(token));
    }

    public static string Hash(string token) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
