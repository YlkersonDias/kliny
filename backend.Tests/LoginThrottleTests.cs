using Kliny.Api.Options;
using Kliny.Api.Services;
using Microsoft.Extensions.Time.Testing;

namespace Kliny.Api.Tests;

public class LoginThrottleTests
{
    private const string Email = "ana@kliny.test";

    private readonly FakeTimeProvider _time = new(new DateTimeOffset(2026, 10, 6, 12, 0, 0, TimeSpan.Zero));
    private readonly LoginThrottle _throttle;

    public LoginThrottleTests()
    {
        // Os valores padrão: 5 falhas em 15 min bloqueiam por 15 min.
        _throttle = new LoginThrottle(Microsoft.Extensions.Options.Options.Create(new RateLimitOptions()), _time);
    }

    private void Fail(int times)
    {
        for (var i = 0; i < times; i++)
            _throttle.RegisterFailure(Email);
    }

    [Fact]
    public void Sem_falhas_nao_bloqueia()
    {
        Assert.Null(_throttle.GetLockout(Email));
    }

    [Fact]
    public void Quatro_falhas_nao_bloqueiam()
    {
        Fail(4);
        Assert.Null(_throttle.GetLockout(Email));
    }

    [Fact]
    public void Quinta_falha_bloqueia_por_15_minutos()
    {
        Fail(5);
        Assert.Equal(TimeSpan.FromMinutes(15), _throttle.GetLockout(Email));

        _time.Advance(TimeSpan.FromMinutes(10));
        Assert.Equal(TimeSpan.FromMinutes(5), _throttle.GetLockout(Email));
    }

    [Fact]
    public void Bloqueio_acaba_depois_de_15_minutos_e_a_contagem_recomeca()
    {
        Fail(5);
        _time.Advance(TimeSpan.FromMinutes(15));
        Assert.Null(_throttle.GetLockout(Email));

        Fail(1);
        Assert.Null(_throttle.GetLockout(Email));
        Fail(4);
        Assert.NotNull(_throttle.GetLockout(Email));
    }

    [Fact]
    public void Falhas_fora_da_janela_de_15_minutos_nao_contam()
    {
        Fail(4);
        _time.Advance(TimeSpan.FromMinutes(15));
        Fail(1);
        Assert.Null(_throttle.GetLockout(Email));
    }

    [Fact]
    public void Janela_desliza_com_as_falhas()
    {
        Fail(2);
        _time.Advance(TimeSpan.FromMinutes(10));
        Fail(2);
        _time.Advance(TimeSpan.FromMinutes(6));
        Fail(1);
        Assert.Null(_throttle.GetLockout(Email));
        Fail(2);
        Assert.NotNull(_throttle.GetLockout(Email));
    }

    [Fact]
    public void Reset_zera_a_contagem()
    {
        Fail(4);
        _throttle.Reset(Email);
        Fail(4);
        Assert.Null(_throttle.GetLockout(Email));
    }

    [Fact]
    public void Emails_sao_independentes()
    {
        Fail(5);
        Assert.NotNull(_throttle.GetLockout(Email));
        Assert.Null(_throttle.GetLockout("bia@kliny.test"));
    }

    [Fact]
    public void Limpeza_mantem_o_bloqueio_em_vigor()
    {
        Fail(5);
        _time.Advance(TimeSpan.FromMinutes(1));
        for (var i = 0; i < 10_001; i++)
            _throttle.RegisterFailure($"outro{i}@kliny.test");

        Assert.Equal(TimeSpan.FromMinutes(14), _throttle.GetLockout(Email));
    }

    [Fact]
    public void Limpeza_descarta_emails_sem_falha_recente_nem_bloqueio()
    {
        Fail(5);
        for (var i = 0; i < 10_001; i++)
            _throttle.RegisterFailure($"outro{i}@kliny.test");

        _time.Advance(TimeSpan.FromMinutes(16));
        _throttle.RegisterFailure("novo@kliny.test");

        Assert.Equal(1, _throttle.Count);
    }

    [Fact]
    public async Task Falhas_simultaneas_nao_se_perdem()
    {
        await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Task.Run(() => _throttle.RegisterFailure(Email))));
        Assert.NotNull(_throttle.GetLockout(Email));
    }
}
