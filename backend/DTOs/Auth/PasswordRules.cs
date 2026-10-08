using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Backend.DTOs.Auth;

public static class PasswordRules
{
    // O BCrypt só usa os primeiros 72 bytes da senha (em UTF-8). Um "é" ocupa 2 bytes e um emoji, 4.
    public const int MaxBytes = 72;
}

// Tamanho máximo em bytes UTF-8, e não em caracteres (S.6).
[AttributeUsage(AttributeTargets.Property)]
public sealed class MaxUtf8BytesAttribute(int maxBytes) : ValidationAttribute
{
    public int MaxBytes { get; } = maxBytes;

    // Nulo fica para o [Required].
    public override bool IsValid(object? value) =>
        value is not string text || Encoding.UTF8.GetByteCount(text) <= MaxBytes;
}
