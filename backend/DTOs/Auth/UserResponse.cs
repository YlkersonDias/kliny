using Backend.Models;

namespace Backend.DTOs.Auth;

// HasPassword e GoogleLinked dizem o que a pessoa pode fazer em Configurações (desvincular o
// Google só com senha; excluir a conta com a senha ou entrando de novo com o Google). O "sub" do
// Google nunca sai daqui.
public record UserResponse(int Id, string Name, string Email, DateTime CreatedAt, bool HasPassword = true, bool GoogleLinked = false)
{
    public static UserResponse FromUser(User user) =>
        new(user.Id, user.Name, user.Email, user.CreatedAt, user.PasswordHash is not null, user.GoogleSubject is not null);
}
