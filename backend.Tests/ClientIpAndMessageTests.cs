using System.Globalization;
using System.Net;
using Kliny.Api.RateLimiting;

namespace Kliny.Api.Tests;

public class ClientIpTests
{
    [Theory]
    [InlineData("203.0.113.7", "203.0.113.7")]
    [InlineData("::ffff:203.0.113.7", "203.0.113.7")]
    [InlineData("2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64")]
    [InlineData("2001:db8:1:2::1", "2001:db8:1:2::/64")]
    public void Chave_por_ip(string ip, string expected)
    {
        Assert.Equal(expected, ClientIp.PartitionKey(IPAddress.Parse(ip)));
    }

    [Fact]
    public void Sem_ip_vira_unknown()
    {
        Assert.Equal("unknown", ClientIp.PartitionKey(null));
    }
}

public class TooManyRequestsMessageTests
{
    [Theory]
    [InlineData(10, "Muitas tentativas. Tente novamente em 1 minuto.")]
    [InlineData(60, "Muitas tentativas. Tente novamente em 1 minuto.")]
    [InlineData(61, "Muitas tentativas. Tente novamente em 2 minutos.")]
    [InlineData(900, "Muitas tentativas. Tente novamente em 15 minutos.")]
    public void Minutos_arredondados_para_cima(int seconds, string expected)
    {
        var previous = CultureInfo.CurrentUICulture;
        CultureInfo.CurrentUICulture = CultureInfo.GetCultureInfo("pt-BR");
        try
        {
            Assert.Equal(expected, TooManyRequests.Message(TimeSpan.FromSeconds(seconds)));
        }
        finally
        {
            CultureInfo.CurrentUICulture = previous;
        }
    }

    [Fact]
    public void Em_ingles()
    {
        var previous = CultureInfo.CurrentUICulture;
        CultureInfo.CurrentUICulture = CultureInfo.GetCultureInfo("en-US");
        try
        {
            Assert.Equal("Too many attempts. Try again in 15 minutes.", TooManyRequests.Message(TimeSpan.FromMinutes(15)));
        }
        finally
        {
            CultureInfo.CurrentUICulture = previous;
        }
    }
}
