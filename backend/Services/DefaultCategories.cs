using Backend.Models;
using Backend.Resources;

namespace Backend.Services;

// Os nomes saem no idioma da requisição que cria a conta e ficam gravados assim.
public static class DefaultCategories
{
    public static List<Category> Create() =>
    [
        New(Messages.DefaultCategoryFood, "green", "cart"),
        New(Messages.DefaultCategoryHousing, "blue", "home"),
        New(Messages.DefaultCategoryTransport, "orange", "car"),
        New(Messages.DefaultCategoryHealth, "pink", "health"),
        New(Messages.DefaultCategoryEducation, "purple", "education"),
        New(Messages.DefaultCategoryLeisure, "indigo", "leisure"),
        New(Messages.DefaultCategoryBills, "amber", "bills"),
        New(Messages.DefaultCategorySalary, "teal", "salary"),
        New(Messages.DefaultCategoryOther, "gray", "tag"),
    ];

    private static Category New(string name, string color, string icon) => new() { Name = name, Color = color, Icon = icon };
}
