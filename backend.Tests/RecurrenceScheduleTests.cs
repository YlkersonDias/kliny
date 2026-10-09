using Backend.Services;

namespace Backend.Tests;

// Datas das recorrências mensais (8.5a), sem banco.
public class RecurrenceScheduleTests
{
    [Theory]
    [InlineData("2026-01-31", 31, "2026-02-28")]
    [InlineData("2028-01-31", 31, "2028-02-29")]
    [InlineData("2026-02-28", 31, "2026-03-31")]
    [InlineData("2026-03-31", 31, "2026-04-30")]
    [InlineData("2026-04-30", 30, "2026-05-30")]
    [InlineData("2026-12-15", 15, "2027-01-15")]
    [InlineData("2026-02-28", 29, "2026-03-29")]
    public void Proxima_ocorrencia_mantem_o_dia_e_cai_no_ultimo_dia_dos_meses_curtos(string date, int day, string expected)
    {
        Assert.Equal(DateOnly.Parse(expected), RecurrenceSchedule.Next(DateOnly.Parse(date), day));
    }

    [Fact]
    public void Um_ano_de_dia_31()
    {
        var date = new DateOnly(2026, 1, 31);
        var dates = new List<DateOnly> { date };
        for (var i = 0; i < 11; i++)
            dates.Add(date = RecurrenceSchedule.Next(date, 31));

        Assert.Equal(
            ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31", "2026-06-30",
             "2026-07-31", "2026-08-31", "2026-09-30", "2026-10-31", "2026-11-30", "2026-12-31"],
            dates.Select(d => d.ToString("yyyy-MM-dd")));
    }

    [Theory]
    [InlineData("2026-02-10", "2026-02-28")]
    [InlineData("2028-02-01", "2028-02-29")]
    [InlineData("2026-12-31", "2026-12-31")]
    public void Fim_do_mes(string date, string expected)
    {
        Assert.Equal(DateOnly.Parse(expected), RecurrenceSchedule.EndOfMonth(DateOnly.Parse(date)));
    }
}
