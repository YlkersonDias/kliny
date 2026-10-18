namespace Backend.DTOs.Categories;

// Só chaves de uma lista fechada, nunca um código de cor ou desenho vindo de fora. O frontend tem a
// mesma lista (lib/categoryAppearance.ts).
public static class CategoryAppearance
{
    public const int MaxLength = 20;

    public static readonly IReadOnlySet<string> Colors = new HashSet<string>(
    [
        "blue", "indigo", "purple", "pink", "orange", "amber", "teal", "green", "brown", "gray",
    ]);

    public static readonly IReadOnlySet<string> Icons = new HashSet<string>(
    [
        "cart", "home", "car", "bus", "food", "coffee", "health", "education", "leisure", "gift", "pets", "clothes",
        "salary", "invest", "travel", "bills", "phone", "streaming", "gym", "beauty", "baby", "tools", "savings", "tag",
    ]);
}
