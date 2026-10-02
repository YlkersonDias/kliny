using System.ComponentModel.DataAnnotations;

namespace Backend.Options;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    [Required]
    public string Issuer { get; set; } = string.Empty;

    [Required]
    public string Audience { get; set; } = string.Empty;

    // Vem do user-secrets (Jwt:Key). HMAC-SHA256 exige pelo menos 32 bytes.
    [Required, MinLength(32)]
    public string Key { get; set; } = string.Empty;

    [Range(1, 1440)]
    public int ExpirationMinutes { get; set; } = 60;
}
