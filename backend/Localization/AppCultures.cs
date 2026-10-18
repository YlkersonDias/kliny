using System.Globalization;

namespace Kliny.Api.Localization;

// Idioma ausente ou não suportado responde em pt-BR.
public static class AppCultures
{
    public const string Portuguese = "pt-BR";
    public const string English = "en-US";
    public static readonly string[] Supported = [Portuguese, English];

    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo(Portuguese);

    // A moeda é sempre o real: o en-US do .NET usaria "$".
    private static readonly NumberFormatInfo EnUsReal = CreateEnUsReal();

    private static NumberFormatInfo CreateEnUsReal()
    {
        var format = (NumberFormatInfo)CultureInfo.GetCultureInfo(English).NumberFormat.Clone();
        format.CurrencySymbol = "R$";
        return NumberFormatInfo.ReadOnly(format);
    }

    public static bool IsEnglish => CultureInfo.CurrentUICulture.Name == English;

    // Mesmo formato do formatMoney do frontend.
    public static string FormatMoney(decimal value) =>
        IsEnglish ? value.ToString("C", EnUsReal) : value.ToString("C", PtBr);

    // Mesmo formato do formatDate do frontend.
    public static string FormatDate(DateOnly date) =>
        IsEnglish
            ? date.ToString("MM/dd/yyyy", CultureInfo.InvariantCulture)
            : date.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
}
