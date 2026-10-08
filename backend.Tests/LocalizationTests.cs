using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Backend.Tests;

// Idioma das mensagens da API (7.3): o Accept-Language escolhe pt-BR ou en-US; sem o cabeçalho,
// ou com outro idioma, vale o português. Cada caso roda nos quatro cenários de Languages.
public static class Localization
{
    // Accept-Language enviado (null = sem o cabeçalho) e se a resposta deve vir em inglês.
    public static TheoryData<string?, bool> Languages => new()
    {
        { null, false },
        { "pt-BR", false },
        { "en-US", true },
        { "fr-FR", false },
    };

    public static HttpRequestMessage Request(HttpMethod method, string url, string? language, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (body is not null)
            request.Content = JsonContent.Create(body);
        if (language is not null)
            request.Headers.AcceptLanguage.ParseAdd(language);
        return request;
    }

    // O "detail" e todas as mensagens de "errors" do ProblemDetails, com o espaço não separável
    // (que o .NET usa em "R$ 100,00") trocado por espaço comum.
    public static async Task<List<string>> MessagesOf(HttpResponseMessage response)
    {
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(TestContext.Current.CancellationToken);
        var messages = new List<string>();
        if (body.TryGetProperty("detail", out var detail) && detail.ValueKind == JsonValueKind.String)
            messages.Add(detail.GetString()!);
        if (body.TryGetProperty("errors", out var errors))
            foreach (var field in errors.EnumerateObject())
                messages.AddRange(field.Value.EnumerateArray().Select(m => m.GetString()!));
        return messages.Select(Normalize).ToList();
    }

    public static string Normalize(string text) => text.Replace(' ', ' ').Replace(' ', ' ');
}

// Usuário com R$ 1.000,00 de receita em 01/03/2021, a categoria "Mercado" e o cofre "Reserva"
// com R$ 100,00 (depósito em 10/03/2021). Criado uma vez: o cadastro tem limite de 5 por hora por IP,
// e esta classe usa 3 (este e os dois do e-mail repetido).
public sealed class LocalizationFixture : IAsyncLifetime
{
    public const string Email = "idiomas@kliny.test";

    public MySqlApi Api { get; } = new();
    public string Token { get; private set; } = "";
    public int Vault { get; private set; }

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        await Api.InitializeAsync();
        if (!Api.IsAvailable)
            return;

        Token = await Api.RegisterAsync(Email);
        using var client = Api.Client(Token);
        await Ok(client.PostAsJsonAsync("/api/transactions",
            new { description = "Saldo inicial", amount = 1000.00m, date = "2021-03-01" }, Ct));
        await Ok(client.PostAsJsonAsync("/api/categories", new { name = "Mercado" }, Ct));

        using var vault = await client.PostAsJsonAsync("/api/vaults", new { name = "Reserva" }, Ct);
        vault.EnsureSuccessStatusCode();
        Vault = (await vault.Content.ReadFromJsonAsync<JsonElement>(Ct)).GetProperty("id").GetInt32();
        await Ok(client.PostAsJsonAsync($"/api/vaults/{Vault}/deposit",
            new { amount = 100.00m, date = "2021-03-10" }, Ct));
    }

    public ValueTask DisposeAsync() => Api.DisposeAsync();

    private static async Task Ok(Task<HttpResponseMessage> request)
    {
        using var response = await request;
        response.EnsureSuccessStatusCode();
    }
}

// Mensagens que passam pelos services de verdade (MySQL no CI).
public class LocalizationTests(LocalizationFixture fixture) : IClassFixture<LocalizationFixture>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<(HttpStatusCode Status, List<string> Messages)> Send(
        HttpMethod method, string url, string? language, object? body = null, bool authenticated = true,
        bool idempotencyKeys = true)
    {
        using var client = fixture.Api.Client(authenticated ? fixture.Token : null, idempotencyKeys);
        using var response = await client.SendAsync(Localization.Request(method, url, language, body), Ct);
        return (response.StatusCode, await Localization.MessagesOf(response));
    }

    private static void AssertMessage(
        (HttpStatusCode Status, List<string> Messages) result, HttpStatusCode status, bool english, string portuguese, string englishText)
    {
        Assert.Equal(status, result.Status);
        Assert.Contains(english ? englishText : portuguese, result.Messages);
    }

    private string VaultUrl(string operation) => $"/api/vaults/{fixture.Vault}/{operation}";

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Login_errado(string? language, bool english) =>
        // Um e-mail por idioma: o bloqueio por e-mail começa na 5ª falha.
        AssertMessage(await Send(HttpMethod.Post, "/api/auth/login", language,
                new { email = $"ninguem-{language ?? "sem"}@kliny.test", password = "senha-errada" }, authenticated: false),
            HttpStatusCode.Unauthorized, english,
            "E-mail ou senha inválidos.", "Invalid email or password.");

    [Theory]
    [InlineData(null, false)]
    [InlineData("en-US", true)]
    public async Task Email_repetido(string? language, bool english) =>
        // Só dois idiomas: cada tentativa conta no limite de 5 cadastros por hora.
        AssertMessage(await Send(HttpMethod.Post, "/api/auth/register", language,
                new { name = "Outra", email = LocalizationFixture.Email, password = "senha12345" }, authenticated: false),
            HttpStatusCode.Conflict, english,
            "Este e-mail já está cadastrado.", "This email is already registered.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Categoria_nao_encontrada(string? language, bool english) =>
        AssertMessage(await Send(HttpMethod.Get, "/api/categories/999999", language),
            HttpStatusCode.NotFound, english,
            "Categoria não encontrada.", "Category not found.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Categoria_repetida(string? language, bool english) =>
        // Sem acento e em minúsculas: a collation conta como o mesmo nome.
        AssertMessage(await Send(HttpMethod.Post, "/api/categories", language, new { name = "mercado" }),
            HttpStatusCode.Conflict, english,
            "Já existe uma categoria com esse nome.", "A category with this name already exists.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Valor_zero(string? language, bool english) =>
        AssertMessage(await Send(HttpMethod.Post, "/api/transactions", language,
                new { description = "Zero", amount = 0m, date = "2021-03-02" }),
            HttpStatusCode.BadRequest, english,
            "O valor não pode ser zero.", "The amount cannot be zero.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Valor_com_tres_casas(string? language, bool english) =>
        AssertMessage(await Send(HttpMethod.Post, "/api/transactions", language,
                new { description = "Três casas", amount = 1.234m, date = "2021-03-02" }),
            HttpStatusCode.BadRequest, english,
            "O valor deve ter no máximo duas casas decimais.", "The amount must have at most two decimal places.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Pagina_invalida(string? language, bool english) =>
        AssertMessage(await Send(HttpMethod.Get, "/api/transactions?page=0", language),
            HttpStatusCode.BadRequest, english,
            "A página deve ficar entre 1 e 1.000.000.", "The page must be between 1 and 1,000,000.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Meta_zero(string? language, bool english) =>
        AssertMessage(await Send(HttpMethod.Post, "/api/vaults", language, new { name = "Meta zero", goal = 0m }),
            HttpStatusCode.BadRequest, english,
            "A meta deve ser maior que zero.", "The goal must be greater than zero.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Retirada_acima_do_saldo_do_cofre(string? language, bool english) =>
        AssertMessage(await Send(HttpMethod.Post, VaultUrl("withdraw"), language, new { amount = 500m, date = "2021-03-10" }),
            HttpStatusCode.BadRequest, english,
            "Saldo insuficiente no cofre. Disponível: R$ 100,00.", "Insufficient vault balance. Available: R$100.00.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Deposito_acima_do_saldo_da_conta(string? language, bool english) =>
        // R$ 1.000,00 de receita menos R$ 100,00 já depositados.
        AssertMessage(await Send(HttpMethod.Post, VaultUrl("deposit"), language, new { amount = 5000m, date = "2021-03-10" }),
            HttpStatusCode.BadRequest, english,
            "Saldo insuficiente na conta. Disponível em 10/03/2021: R$ 900,00.",
            "Insufficient account balance. Available on 03/10/2021: R$900.00.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Deposito_antes_da_primeira_receita(string? language, bool english) =>
        AssertMessage(await Send(HttpMethod.Post, VaultUrl("deposit"), language, new { amount = 10m, date = "2021-02-01" }),
            HttpStatusCode.BadRequest, english,
            "Saldo insuficiente na conta. Disponível em 01/02/2021: R$ 0,00. Lance uma receita antes de depositar.",
            "Insufficient account balance. Available on 02/01/2021: R$0.00. Add income before depositing.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Operacao_de_cofre_sem_idempotency_key(string? language, bool english) =>
        AssertMessage(await Send(HttpMethod.Post, VaultUrl("deposit"), language, new { amount = 10m, date = "2021-03-10" },
                idempotencyKeys: false),
            HttpStatusCode.BadRequest, english,
            "Envie o cabeçalho Idempotency-Key: depósitos e retiradas precisam dele para não serem gravados duas vezes.",
            "Send the Idempotency-Key header: deposits and withdrawals need it so they are not recorded twice.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Operacao_de_cofre_com_data_futura(string? language, bool english) =>
        AssertMessage(await Send(HttpMethod.Post, VaultUrl("deposit"), language, new { amount = 10m, date = "2099-01-01" }),
            HttpStatusCode.BadRequest, english,
            "Operações de cofre não podem ter data futura.", "Vault operations cannot have a future date.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Relatorio_com_inicio_depois_do_fim(string? language, bool english) =>
        AssertMessage(await Send(HttpMethod.Get, "/api/reports/summary?from=2026-02-01&to=2026-01-01", language),
            HttpStatusCode.BadRequest, english,
            "A data inicial não pode ser depois da data final.", "The start date cannot be after the end date.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Relatorio_com_mais_de_dez_anos(string? language, bool english) =>
        AssertMessage(await Send(HttpMethod.Get, "/api/reports/summary?from=2000-01-01&to=2020-01-01", language),
            HttpStatusCode.BadRequest, english,
            "O período deve ter no máximo 10 anos.", "The period must be at most 10 years.");

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Descricao_padrao_do_deposito_e_da_retirada(string? language, bool english)
    {
        // Depósito e retirada do mesmo valor: o saldo do cofre volta a R$ 100,00 para os outros testes.
        Assert.Equal(english ? "Deposit to vault Reserva" : "Depósito no cofre Reserva",
            await DescriptionOf("deposit", language));
        Assert.Equal(english ? "Withdrawal from vault Reserva" : "Retirada do cofre Reserva",
            await DescriptionOf("withdraw", language));
    }

    private async Task<string> DescriptionOf(string operation, string? language)
    {
        using var client = fixture.Api.Client(fixture.Token);
        using var response = await client.SendAsync(
            Localization.Request(HttpMethod.Post, VaultUrl(operation), language, new { amount = 10m, date = "2021-03-10" }), Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        return body.GetProperty("transaction").GetProperty("description").GetString()!;
    }
}

// Validação do cadastro, sem MySQL: o modelo é validado antes de chegar ao service.
public class RegisterLocalizationTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [MemberData(nameof(Localization.Languages), MemberType = typeof(Localization))]
    public async Task Cadastro_invalido(string? language, bool english)
    {
        using var app = new TestApp();
        using var client = app.CreateClient();
        using var response = await client.SendAsync(Localization.Request(HttpMethod.Post, "/api/auth/register", language,
            new { name = "", email = "sem-arroba", password = "123" }), Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var messages = await Localization.MessagesOf(response);
        Assert.Contains(english ? "Enter your name." : "Informe o nome.", messages);
        Assert.Contains(english ? "Invalid email." : "E-mail inválido.", messages);
        Assert.Contains(english ? "The password must be between 8 and 72 characters." : "A senha deve ter entre 8 e 72 caracteres.", messages);
    }
}
