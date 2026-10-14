namespace Backend.DTOs.Categories;

// Cor e ícone de uma categoria: só chaves de uma lista fechada (regras 6 e 7), nunca um código de
// cor ou um desenho vindo de fora. O frontend tem a mesma lista (lib/categoryAppearance.ts), com o
// tom de cada cor nos dois temas e o desenho de cada ícone. Nulo: cor neutra e ícone de etiqueta.
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
