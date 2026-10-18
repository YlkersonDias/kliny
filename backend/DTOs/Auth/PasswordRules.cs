using System.ComponentModel.DataAnnotations;
using System.Text;

namespace Backend.DTOs.Auth;

public static class PasswordRules
{
    // O BCrypt só usa os primeiros 72 bytes da senha (em UTF-8).
    public const int MaxBytes = 72;
}

[AttributeUsage(AttributeTargets.Property)]
public sealed class MaxUtf8BytesAttribute(int maxBytes) : ValidationAttribute
{
    public int MaxBytes { get; } = maxBytes;

    // Nulo fica para o [Required].
    public override bool IsValid(object? value) =>
        value is not string text || Encoding.UTF8.GetByteCount(text) <= MaxBytes;
}
