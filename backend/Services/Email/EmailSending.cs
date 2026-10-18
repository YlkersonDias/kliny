using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Channels;
using Backend.Options;
using Microsoft.Extensions.Options;

namespace Backend.Services.Email;

// Só texto: nenhum HTML montado com dados do usuário.
public record EmailMessage(string To, string Subject, string Text);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

// O e-mail sai em segundo plano: o tempo da resposta não pode revelar se o e-mail tem conta.
public interface IEmailQueue
{
    /// <returns>false se a fila está cheia (o e-mail não sai).</returns>
    bool TryEnqueue(EmailMessage message);
}

public sealed class EmailQueue : IEmailQueue
{
    // Limitada: um volume anormal descarta, em vez de acumular na memória.
    private readonly Channel<EmailMessage> _channel = Channel.CreateBounded<EmailMessage>(
        new BoundedChannelOptions(200) { FullMode = BoundedChannelFullMode.DropWrite, SingleReader = true });

    public bool TryEnqueue(EmailMessage message) => _channel.Writer.TryWrite(message);

    public IAsyncEnumerable<EmailMessage> ReadAllAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAllAsync(cancellationToken);
}

// O log nunca leva o destinatário, o assunto nem o texto (que tem o link com o token).
public sealed class EmailWorker(EmailQueue queue, IEmailSender sender, ILogger<EmailWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var message in queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await sender.SendAsync(message, stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError("Falha ao enviar um e-mail ({Error}).", ex.GetType().Name);
            }
        }
    }
}

// https://resend.com/docs/api-reference/emails/send-email
public sealed class ResendEmailSender(HttpClient http, IOptions<EmailOptions> options, ILogger<ResendEmailSender> logger) : IEmailSender
{
    public const string BaseAddress = "https://api.resend.com/";

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken)
    {
        var settings = options.Value;
        if (!settings.Enabled)
        {
            logger.LogWarning("Envio de e-mail desligado (sem Email:ApiKey): a mensagem foi descartada.");
            return;
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, "emails")
        {
            Content = JsonContent.Create(new { from = settings.From, to = new[] { message.To }, subject = message.Subject, text = message.Text }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ApiKey);
        using var response = await http.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode)
            logger.LogInformation("E-mail enviado.");
        else
            logger.LogError("O serviço de e-mail recusou o envio (HTTP {Status}).", (int)response.StatusCode);
    }
}
