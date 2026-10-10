using System.Security.Cryptography;
using System.Text;

namespace Backend.Security;

// Token de link mandado por e-mail (troca de senha e confirmação de cadastro): 256 bits aleatórios
// em Base64 URL (43 caracteres). O banco guarda só o SHA-256 em hex: quem lê o banco ou um backup
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
