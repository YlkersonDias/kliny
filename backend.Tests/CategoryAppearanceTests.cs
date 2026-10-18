using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using static Backend.Tests.FakeGoogleTokenValidator;

namespace Backend.Tests;

public class CategoryAppearanceTests(MySqlApi api) : IClassFixture<MySqlApi>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static readonly (string Name, string Color, string Icon)[] DefaultsPt =
    [
        ("Alimentação", "green", "cart"), ("Moradia", "blue", "home"), ("Transporte", "orange", "car"),
        ("Saúde", "pink", "health"), ("Educação", "purple", "education"), ("Lazer", "indigo", "leisure"),
        ("Contas", "amber", "bills"), ("Salário", "teal", "salary"), ("Outros", "gray", "tag"),
    ];

    private async Task<JsonElement[]> CategoriesAsync(string token)
    {
        using var client = api.Client(token);
        return (await client.GetFromJsonAsync<JsonElement>("/api/categories", Ct)).EnumerateArray().ToArray();
    }

    private static (string Name, string? Color, string? Icon) Read(JsonElement category) =>
        (category.GetProperty("name").GetString()!, category.GetProperty("color").GetString(), category.GetProperty("icon").GetString());

    [Fact]
    public async Task Conta_nova_pelo_cadastro_nasce_com_as_categorias_padrao()
    {
        var token = await api.RegisterAsync($"padrao-{Guid.NewGuid():N}@kliny.test");
        var categories = (await CategoriesAsync(token)).Select(Read).ToArray();
        Assert.Equal(DefaultsPt.Length, categories.Length);
        foreach (var expected in DefaultsPt)
            Assert.Contains((expected.Name, (string?)expected.Color, (string?)expected.Icon), categories);
    }

    [Fact]
    public async Task Cadastro_terminado_em_ingles_cria_os_nomes_em_ingles()
    {
        var email = $"padrao-en-{Guid.NewGuid():N}@kliny.test";
        using var client = api.Client();
        var seen = api.Emails.CountFor(email);
        using (var requested = await client.PostAsJsonAsync("/api/auth/register", new { name = "Teste", email }, Ct))
            requested.EnsureSuccessStatusCode();
        var message = await api.Emails.WaitForAsync(email, seen, Ct);
        var link = MySqlApi.RegistrationLink().Match(message.Text).Groups[1].Value;

        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/register/complete")
        {
            Content = JsonContent.Create(new { token = link, password = "senha12345" }),
        };
        request.Headers.AcceptLanguage.ParseAdd("en-US");
        using var response = await client.SendAsync(request, Ct);
        response.EnsureSuccessStatusCode();
        var token = (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("token").GetString()!;

        var names = (await CategoriesAsync(token)).Select((c) => c.GetProperty("name").GetString()).ToArray();
        Assert.Equal(["Bills", "Education", "Food", "Health", "Housing", "Leisure", "Other", "Salary", "Transportation"], names);
    }

    [Fact]
    public async Task Conta_nova_pelo_Google_nasce_com_as_categorias_padrao_e_vincular_nao_acrescenta()
    {
        using (var client = api.Client())
        using (var created = await client.PostAsJsonAsync("/api/auth/google",
            new { credential = Credential($"g-{Guid.NewGuid():N}", $"nova-{Guid.NewGuid():N}@gmail.com") }, Ct))
        {
            created.EnsureSuccessStatusCode();
            var token = (await created.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("token").GetString()!;
            Assert.Equal(DefaultsPt.Length, (await CategoriesAsync(token)).Length);
        }

        var email = $"vincula-{Guid.NewGuid():N}@gmail.com";
        var existing = await api.RegisterAsync(email);
        using (var client = api.Client())
        using (var linked = await client.PostAsJsonAsync("/api/auth/google", new { credential = Credential($"g-{Guid.NewGuid():N}", email) }, Ct))
            linked.EnsureSuccessStatusCode();
        Assert.Equal(DefaultsPt.Length, (await CategoriesAsync(existing)).Length);
    }

    [Fact]
    public async Task Cria_e_edita_com_cor_e_icone()
    {
        var token = await api.RegisterAsync($"cor-{Guid.NewGuid():N}@kliny.test");
        using var client = api.Client(token);

        using var created = await client.PostAsJsonAsync("/api/categories", new { name = "Pets da casa", color = "brown", icon = "pets" }, Ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var body = await created.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(("Pets da casa", "brown", "pets"), Read(body));
        var id = body.GetProperty("id").GetInt32();

        using (var updated = await client.PutAsJsonAsync($"/api/categories/{id}", new { name = "Pets", color = "teal", icon = "gift" }, Ct))
            Assert.Equal(("Pets", "teal", "gift"), Read(await updated.Content.ReadFromJsonAsync<JsonElement>(Ct)));

        using (var cleared = await client.PutAsJsonAsync($"/api/categories/{id}", new { name = "Pets" }, Ct))
            Assert.Equal(("Pets", (string?)null, (string?)null), Read(await cleared.Content.ReadFromJsonAsync<JsonElement>(Ct)));

        using var plain = await client.PostAsJsonAsync("/api/categories", new { name = "Sem visual" }, Ct);
        Assert.Equal(("Sem visual", (string?)null, (string?)null), Read(await plain.Content.ReadFromJsonAsync<JsonElement>(Ct)));
    }

    [Theory]
    [InlineData("#ff0000", "cart", "Color", "Cor inválida.")]
    [InlineData("red", "cart", "Color", "Cor inválida.")]
    [InlineData("", "cart", "Color", "Cor inválida.")]
    [InlineData("green", "rocket", "Icon", "Ícone inválido.")]
    [InlineData("green", "<svg>", "Icon", "Ícone inválido.")]
    public async Task Cor_ou_icone_fora_da_lista_responde_400(string color, string icon, string field, string message)
    {
        var token = await api.RegisterAsync($"invalida-{Guid.NewGuid():N}@kliny.test");
        using var client = api.Client(token);
        using var response = await client.PostAsJsonAsync("/api/categories", new { name = $"Inválida {Guid.NewGuid():N}", color, icon }, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await response.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("errors");
        Assert.Equal(message, errors.GetProperty(field)[0].GetString());
    }
}
