using System.ComponentModel.DataAnnotations;
using Microsoft.Extensions.Options;

namespace Backend.Options;

// Limites de tentativas do login, do cadastro e da recuperação de senha (seção "RateLimits" do appsettings.json).
public class RateLimitOptions
{
    public const string SectionName = "RateLimits";

    // Por IP, com janela deslizante: barra o volume antes de chegar ao BCrypt.
    [Required, ValidateObjectMembers]
    public SlidingWindowLimit LoginPerIp { get; set; } = new() { PermitLimit = 10, WindowSeconds = 60 };

    [Required, ValidateObjectMembers]
    public SlidingWindowLimit RegisterPerIp { get; set; } = new() { PermitLimit = 5, WindowSeconds = 3600 };

    // "Esqueci minha senha" e a troca pelo link, juntos: barra quem tenta adivinhar tokens e quem
    // usa o Kliny para mandar e-mail a muitos endereços.
    [Required, ValidateObjectMembers]
    public SlidingWindowLimit PasswordResetPerIp { get; set; } = new() { PermitLimit = 10, WindowSeconds = 3600 };

    // Por e-mail, só no login: trava quem troca de IP para atacar a mesma conta.
    [Required, ValidateObjectMembers]
    public LoginLockout LoginPerEmail { get; set; } = new();
}

public class SlidingWindowLimit
{
    [Range(1, 10_000)]
    public int PermitLimit { get; set; }

    [Range(1, 86_400)]
    public int WindowSeconds { get; set; }

    public TimeSpan Window => TimeSpan.FromSeconds(WindowSeconds);
}

public class LoginLockout
{
    // Falhas dentro da janela que bloqueiam o e-mail.
    [Range(1, 100)]
    public int MaxFailures { get; set; } = 5;

    [Range(1, 1440)]
    public int WindowMinutes { get; set; } = 15;

    // Curto de propósito: o bloqueio por e-mail deixa alguém travar a conta de outra pessoa.
    [Range(1, 1440)]
    public int LockoutMinutes { get; set; } = 15;
}
