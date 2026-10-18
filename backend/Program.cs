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

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not configured.");

// Usuário do token, para o filtro global do AppDbContext.
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 4, 0))));

builder.Services.AddOptions<JwtOptions>()
    .Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>>((options, jwtOptions) =>
    {
        var jwt = jwtOptions.Value;

        // Claims com o nome original (sub, email, name).
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
            // Só HS256: qualquer outro algoritmo, inclusive "none", é recusado.
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = JwtRegisteredClaimNames.Name,
        };
        // Revogação: a versão do token precisa bater com a do usuário no banco.
        options.Events = new JwtBearerEvents { OnTokenValidated = TokenVersionValidation.ValidateAsync };
    });

// Todo endpoint exige login, salvo os com [AllowAnonymous] (conferidos no AuthorizationTests).
builder.Services.AddAuthorization(options => options.FallbackPolicy = options.DefaultPolicy);

builder.Services.AddAppRateLimiting(builder.Configuration);

builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();

// Sem Google:ClientId, as rotas do Google respondem 404.
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

// O e-mail sai em segundo plano, para a resposta não demorar mais quando a conta existe.
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

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();

builder.Services.AddControllers();

builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    options.SetDefaultCulture(AppCultures.Portuguese)
        .AddSupportedCultures(AppCultures.Supported)
        .AddSupportedUICultures(AppCultures.Supported);
    options.RequestCultureProviders = [new AcceptLanguageHeaderRequestCultureProvider()];
});

builder.Services.AddOpenApi();

builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// HSTS curto de propósito: se o HTTPS quebrar, os navegadores recusam o site pelo tempo inteiro dele.
var hstsMaxAgeDays = builder.Configuration.GetValue("Hsts:MaxAgeDays", 30);
if (hstsMaxAgeDays is < 1 or > 730)
    throw new InvalidOperationException("Hsts:MaxAgeDays deve ficar entre 1 e 730.");
builder.Services.AddHsts(options =>
{
    options.MaxAge = TimeSpan.FromDays(hstsMaxAgeDays);
    options.IncludeSubDomains = false;
    options.Preload = false;
});

// X-Forwarded-* só valem vindos das redes confiáveis (a rede interna do Docker): senão qualquer um
// escolheria o próprio IP e fugiria do limite de tentativas.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
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

// Primeiro: o IP real vale para o limite de tentativas e o HSTS.
app.UseForwardedHeaders();

app.UseSecurityHeaders();

// Antes do tratamento de erros, para as mensagens saírem no idioma pedido.
app.UseRequestLocalization();
app.UseExceptionHandler();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHsts();
}

app.UseHttpsRedirection();

// Antes da autenticação: a tentativa recusada não chega a rodar o BCrypt.
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
