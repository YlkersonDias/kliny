using Kliny.Api.Security;
using MsOptions = Microsoft.Extensions.Options.Options;

namespace Kliny.Api.Tests;

// Sem rede: só casos recusados antes de buscar as chaves do Google.
public class GoogleTokenValidatorTests
{
    private static GoogleTokenValidator Validator(string? clientId) =>
        new(MsOptions.Create(new GoogleOptions { ClientId = clientId }));

    [Theory]
    [InlineData("")]
    [InlineData("lixo")]
    [InlineData("a.b")]
    [InlineData("não.é.jwt")]
    [InlineData("eyJhIjo.eyJhIjo.c2ln")]
    [InlineData("bnVsbA.bnVsbA.c2ln")]
    public async Task Comprovante_malformado_e_recusado(string credential)
    {
        Assert.Null(await Validator("cliente.apps.googleusercontent.com").ValidateAsync(credential));
    }

    [Fact]
    public async Task Sem_ClientId_o_login_com_Google_fica_desligado()
    {
        Assert.False(new GoogleOptions().Enabled);
        Assert.Null(await Validator(null).ValidateAsync(FakeGoogleTokenValidator.Credential("g", "x@gmail.com")));
    }

    [Theory]
    [InlineData("pessoa@gmail.com", true, null, true)]
    [InlineData("Pessoa@GMAIL.com", true, null, true)]
    [InlineData("pessoa@gmail.com", false, null, false)]
    [InlineData("ana@empresa.com.br", true, "empresa.com.br", true)]
    [InlineData("ana@empresa.com.br", false, "empresa.com.br", false)]
    [InlineData("pessoa@outlook.com", true, null, false)]
    [InlineData("pessoa@gmail.com.br", true, null, false)]
    [InlineData("pessoa@googlemail.com", true, null, false)]
    public void Google_so_e_autoridade_em_Gmail_e_Workspace_verificados(string email, bool verified, string? hostedDomain, bool expected)
    {
        Assert.Equal(expected, new GoogleIdentity("sub", email, verified, hostedDomain, null).IsEmailAuthoritative);
    }
}
