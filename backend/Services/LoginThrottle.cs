using System.Collections.Concurrent;
using Backend.Options;
using Microsoft.Extensions.Options;

namespace Backend.Services;

// Bloqueia o e-mail depois de MaxFailures falhas dentro de WindowMinutes, por LockoutMinutes.
// Conta qualquer e-mail, exista a conta ou não, para o bloqueio não revelar quem está cadastrado.
// Fica na memória: some ao reiniciar e vale para um servidor só.
public class LoginThrottle(IOptions<RateLimitOptions> options, TimeProvider timeProvider) : ILoginThrottle
{
    // Acima disso, uma falha nova aproveita para descartar os e-mails que já não importam,
    // no máximo uma vez por minuto (a varredura passa por todos).
    private const int PruneThreshold = 10_000;
    private static readonly TimeSpan PruneInterval = TimeSpan.FromMinutes(1);

    private readonly LoginLockout _limits = options.Value.LoginPerEmail;
    private readonly ConcurrentDictionary<string, Entry> _entries = new();
    // Corrida aqui só faz duas falhas varrerem juntas: inofensivo.
    private DateTimeOffset _lastPrune;

    // E-mails guardados agora (para os testes da limpeza).
    internal int Count => _entries.Count;

    private TimeSpan Window =>TimeSpan.FromMinutes(_limits.WindowMinutes);
    private TimeSpan Lockout => TimeSpan.FromMinutes(_limits.LockoutMinutes);

    public TimeSpan? GetLockout(string email)
    {
        if (!_entries.TryGetValue(email, out var entry))
            return null;

        var now = timeProvider.GetUtcNow();
        lock (entry)
            return entry.LockedUntil > now ? entry.LockedUntil - now : null;
    }

    public void RegisterFailure(string email)
    {
        var now = timeProvider.GetUtcNow();

        while (true)
        {
            var entry = _entries.GetOrAdd(email, _ => new Entry());
            lock (entry)
            {
                // O Reset ou a limpeza podem ter tirado a entrada do dicionário entre o GetOrAdd e o lock.
                if (entry.Removed)
                    continue;
                Record(entry, now);
                break;
            }
        }

        if (_entries.Count > PruneThreshold && now - _lastPrune >= PruneInterval)
        {
            _lastPrune = now;
            Prune(now);
        }
    }

    public void Reset(string email)
    {
        if (_entries.TryGetValue(email, out var entry))
            Remove(email, entry);
    }

    private void Record(Entry entry, DateTimeOffset now)
    {
        entry.LastActivity = now;
        while (entry.Failures.TryPeek(out var oldest) && now - oldest >= Window)
            entry.Failures.Dequeue();

        entry.Failures.Enqueue(now);
        if (entry.Failures.Count >= _limits.MaxFailures)
        {
            // O bloqueio recomeça a contagem: depois dele, são mais MaxFailures falhas.
            entry.LockedUntil = now + Lockout;
            entry.Failures.Clear();
        }
    }

    // Descarta e-mails sem bloqueio em vigor e sem falha dentro da janela.
    private void Prune(DateTimeOffset now)
    {
        foreach (var (email, entry) in _entries)
        {
            lock (entry)
            {
                if (entry.LockedUntil <= now && now - entry.LastActivity >= Window)
                    RemoveLocked(email, entry);
            }
        }
    }

    private void Remove(string email, Entry entry)
    {
        lock (entry)
            RemoveLocked(email, entry);
    }

    // Chamado com o lock da entrada: quem já tem a referência vê o Removed e busca outra.
    private void RemoveLocked(string email, Entry entry)
    {
        entry.Removed = true;
        _entries.TryRemove(KeyValuePair.Create(email, entry));
    }

    private sealed class Entry
    {
        public Queue<DateTimeOffset> Failures { get; } = new();
        public DateTimeOffset LockedUntil { get; set; }
        public DateTimeOffset LastActivity { get; set; }
        public bool Removed { get; set; }
    }
}
