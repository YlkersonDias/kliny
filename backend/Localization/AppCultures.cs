using System.Globalization;

namespace Backend.Localization;

// Idiomas da API, escolhidos pelo Accept-Language (RequestLocalization no Program.cs).
// O português é o padrão: idioma ausente ou não suportado responde em pt-BR.
public static class AppCultures
{
    public const string Portuguese = "pt-BR";
    public const string English = "en-US";
    public static readonly string[] Supported = [Portuguese, English];

    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo(Portuguese);

    // A moeda é sempre o real, nos dois idiomas: em inglês fica "R$1,234.56" (o en-US do .NET usaria "$").
    private static readonly NumberFormatInfo EnUsReal = CreateEnUsReal();

    private static NumberFormatInfo CreateEnUsReal()
    {
        var format = (NumberFormatInfo)CultureInfo.GetCultureInfo(English).NumberFormat.Clone();
        format.CurrencySymbol = "R$";
        return NumberFormatInfo.ReadOnly(format);
    }

    // Idioma da requisição atual (o RequestLocalization define o CurrentUICulture).
    public static bool IsEnglish => CultureInfo.CurrentUICulture.Name == English;

    // Mesmo formato do formatMoney do frontend: "R$ 1.234,56" ou "R$1,234.56".
    public static string FormatMoney(decimal value) =>
        IsEnglish ? value.ToString("C", EnUsReal) : value.ToString("C", PtBr);

    // Mesmo formato do formatDate do frontend: "05/10/2026" ou "10/05/2026".
    public static string FormatDate(DateOnly date) =>
        IsEnglish
            ? date.ToString("MM/dd/yyyy", CultureInfo.InvariantCulture)
            : date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
}
