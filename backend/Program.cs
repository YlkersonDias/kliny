using System.Text;
using Backend.Data;
using Backend.Exceptions;
using Backend.Localization;
using Backend.Options;
using Backend.RateLimiting;
using Backend.Security;
using Backend.Services;
using Backend.Services.Email;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Localization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// A senha do banco vem do user-secrets (ConnectionStrings:DefaultConnection).
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not configured.");

// Usuário logado para o filtro global do AppDbContext (S.6b).
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 4, 0))));

// A chave vem do user-secrets (Jwt:Key). Sem ela, a aplicação não sobe.
builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((options, jwtOptions) =>
    {
        var jwt = jwtOptions.Value;

        // Mantém os nomes originais das claims ("sub", "email", "name").
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            // S.6: só HS256, o algoritmo com que a API assina. Qualquer outro (inclusive "none") é recusado,
            // mesmo que o padrão da biblioteca mude.
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = JwtRegisteredClaimNames.Name,
        };
        // S.5: confere a versão do token com a do usuário no banco (revogação).
        options.Events = new JwtBearerEvents { OnTokenValidated = TokenVersionValidation.ValidateAsync };
    });

// Todo endpoint exige login, salvo os marcados com [AllowAnonymous]: login (com senha e com o Google),
// cadastro (register e register/complete) e recuperação de senha (forgot-password e reset-password),
// conferidos na lista PublicEndpoints do AuthorizationTests. Um controller novo sem [Authorize]
// continua protegido. O OpenAPI também exige login.
builder.Services.AddAuthorization(options => options.FallbackPolicy = options.DefaultPolicy);

// Limites por IP no login, no cadastro, na recuperação de senha e na exportação dos dados (seção
// RateLimits do appsettings.json).
builder.Services.AddAppRateLimiting(builder.Configuration);

builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();

// Login com o Google (seção Google do appsettings.json). Sem ClientId, as rotas respondem 404.
builder.Services.Configure<GoogleOptions>(builder.Configuration.GetSection(GoogleOptions.SectionName));
builder.Services.AddSingleton<IGoogleTokenValidator, GoogleTokenValidator>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ITransactionService, TransactionService>();
builder.Services.AddScoped<IVaultService, VaultService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IBudgetService, BudgetService>();
builder.Services.AddScoped<IRecurrenceService, RecurrenceService>();
builder.Services.AddScoped<IInstallmentService, InstallmentService>();
builder.Services.AddScoped<ICategoryRuleService, CategoryRuleService>();
builder.Services.AddScoped<IImportService, ImportService>();
builder.Services.AddScoped<IExportService, ExportService>();

// Recuperação de senha e envio de e-mail (seção Email; a chave só no deploy/.env). O e-mail sai em
// segundo plano (EmailWorker), para a resposta não demorar mais quando a conta existe.
builder.Services.AddOptions<EmailOptions>()
    .Bind(builder.Configuration.GetSection(EmailOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddSingleton<EmailQueue>();
builder.Services.AddSingleton<IEmailQueue>(services => services.GetRequiredService<EmailQueue>());
builder.Services.AddHttpClient<IEmailSender, ResendEmailSender>(client =>
{
    client.BaseAddress = new Uri(ResendEmailSender.BaseAddress);
    client.Timeout = TimeSpan.FromSeconds(15);
});
builder.Services.AddHostedService<EmailWorker>();
builder.Services.AddSingleton<ISecurityNotifier, SecurityNotifier>();
builder.Services.AddScoped<IPasswordResetService, PasswordResetService>();
builder.Services.AddSingleton<RegistrationEmailThrottle>();
builder.Services.AddScoped<IRegistrationService, RegistrationService>();

// Converte as exceções de domínio (Exceptions/) em respostas ProblemDetails.
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

builder.Services.AddControllers();

// Idioma das mensagens pelo Accept-Language; sem ele, ou com idioma não suportado, português.
builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    options.SetDefaultCulture(AppCultures.Portuguese)
        .AddSupportedCultures(AppCultures.Supported)
        .AddSupportedUICultures(AppCultures.Supported);
    // Só o cabeçalho escolhe o idioma (sem ?culture= nem cookie).
    options.RequestCultureProviders = [new AcceptLanguageHeaderRequestCultureProvider()];
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Sem o cabeçalho "Server: Kestrel": não informa o servidor a quem não precisa saber (S.4).
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// HSTS (S.4), só fora de Development. Começa curto (Hsts:MaxAgeDays, 30 dias) e sem
// includeSubDomains nem preload: se o HTTPS do servidor quebrar, os navegadores recusam o site
// pelo tempo inteiro do HSTS. Aumentar depois que o deploy estiver estável (S.7). O UseHsts só
// manda o cabeçalho em requisição HTTPS: atrás de um proxy reverso, só depois do ForwardedHeaders (S.7).
var hstsMaxAgeDays = builder.Configuration.GetValue("Hsts:MaxAgeDays", 30);
if (hstsMaxAgeDays is < 1 or > 730)
    throw new InvalidOperationException("Hsts:MaxAgeDays deve ficar entre 1 e 730.");
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(hstsMaxAgeDays);
    options.IncludeSubDomains = false;
    options.Preload = false;
});

// S.7: atrás do proxy (o nginx do deploy), o IP de quem acessa e o HTTPS chegam nos cabeçalhos
// X-Forwarded-For e X-Forwarded-Proto. Só são aceitos de um proxy das redes de
// ForwardedHeaders:KnownNetworks (a rede interna do Docker); de qualquer outro endereço, são
// ignorados, senão qualquer um escolheria o próprio IP e fugiria do limite de tentativas.
// Sem redes configuradas, vale só o loopback (o padrão do ASP.NET Core).
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Só o último salto: o nginx põe o IP real (que ele recebeu da Cloudflare) no X-Forwarded-For.
    options.ForwardLimit = 1;
    var networks = builder.Configuration.GetSection("ForwardedHeaders:KnownNetworks").Get<string[]>() ?? [];
    if (networks.Length > 0)
    {
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
        foreach (var network in networks)
            options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
    }
});

var app = builder.Build();

// Antes de tudo: o IP e o esquema reais valem para o limite de tentativas, o HSTS e os logs.
app.UseForwardedHeaders();

// Os cabeçalhos de segurança saem em toda resposta, inclusive nos erros.
app.UseSecurityHeaders();

// Antes do resto: as mensagens de erro do ApiExceptionHandler também saem no idioma pedido.
app.UseRequestLocalization();
app.UseExceptionHandler();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
}

app.UseHttpsRedirection();

// Depois do UseRequestLocalization (mensagem do 429 no idioma pedido) e antes da autenticação:
// a tentativa recusada não chega a validar token nem a rodar o BCrypt.
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
