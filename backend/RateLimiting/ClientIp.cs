using System.Net;
using System.Net.Sockets;

namespace Backend.RateLimiting;

public static class ClientIp
{
    // IPv6 conta pelo prefixo /64: cada cliente costuma ter um /64 inteiro e poderia trocar de
    // endereço a cada tentativa. ::ffff:1.2.3.4 conta como o IPv4.
    public static string PartitionKey(IPAddress? address)
    {
        if (address is null)
            return "unknown";

        if (address.IsIPv4MappedToIPv6)
            address = address.MapToIPv4();

        if (address.AddressFamily != AddressFamily.InterNetworkV6)
            return address.ToString();

        var bytes = address.GetAddressBytes();
        Array.Clear(bytes, 8, 8);
        return new IPAddress(bytes) + "/64";
    }
}
