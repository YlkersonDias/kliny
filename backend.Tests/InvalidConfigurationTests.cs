namespace Backend.Tests;

// Testes que sobem a API com configuração inválida de propósito. Rodam numa coleção sem
// paralelismo: com outros hosts subindo ao mesmo tempo no mesmo processo, a configuração
// inválida vazava para eles (no CI, as fixtures de MySQL não subiam com RateLimits em 0).
// Não devolver estes testes a uma classe comum.
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class InvalidConfigurationCollection
{
    public const string Name = "Configuração inválida";
}

[Collection(InvalidConfigurationCollection.Name)]
public class InvalidConfigurationTests
{
    [Theory]
    [InlineData("RateLimits:LoginPerIp:PermitLimit", "0")]
    [InlineData("RateLimits:RegisterPerIp:WindowSeconds", "0")]
    [InlineData("RateLimits:LoginPerEmail:MaxFailures", "0")]
    public void Limite_invalido_impede_a_api_de_subir(string key, string value)
    {
        using var app = new TestApp(new Dictionary<string, string> { [key] = value });

        var error = Assert.ThrowsAny<Exception>(() => app.CreateClient());
        Assert.Contains(nameof(Backend.Options.RateLimitOptions), error.ToString());
    }
}
