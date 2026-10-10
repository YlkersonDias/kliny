using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Channels;
using Backend.Options;
using Microsoft.Extensions.Options;

namespace Backend.Services.Email;

// Só texto: nenhum HTML montado com dados do usuário (o nome entra como texto).
public record EmailMessage(string To, string Subject, string Text);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken);
}

// Fila do envio: o pedido de "Esqueci minha senha" responde na hora, e o e-mail sai em segundo
// plano. Sem isso, o tempo da resposta (com ou sem envio) revelaria se o e-mail tem conta (regra 4).
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

// Esvazia a fila. O log nunca leva o destinatário, o assunto nem o texto (que tem o link com o
// token): só se deu certo ou não (regras 11 e 16).
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

// Resend (https://resend.com/docs/api-reference/emails/send-email): POST /emails com a chave.
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
