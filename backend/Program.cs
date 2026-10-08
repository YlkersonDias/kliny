using System.Text;
using Backend.Data;
using Backend.Exceptions;
using Backend.Localization;
using Backend.Options;
using Backend.RateLimiting;
using Backend.Security;
using Backend.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Localization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// A senha do banco vem do user-secrets (ConnectionStrings:DefaultConnection).
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not configured.");

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
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = JwtRegisteredClaimNames.Name,
        };
    });

// Todo endpoint exige login, salvo os marcados com [AllowAnonymous] (só cadastro e login).
// Um controller novo sem [Authorize] continua protegido. O OpenAPI também exige login.
builder.Services.AddAuthorization(options => options.FallbackPolicy = options.DefaultPolicy);

// Limite de tentativas no login e no cadastro (seção RateLimits do appsettings.json).
builder.Services.AddAppRateLimiting(builder.Configuration);

builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ITransactionService, TransactionService>();
builder.Services.AddScoped<IVaultService, VaultService>();
builder.Services.AddScoped<IReportService, ReportService>();

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

var app = builder.Build();

// Primeiro de tudo: os cabeçalhos de segurança saem em toda resposta, inclusive nos erros.
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
