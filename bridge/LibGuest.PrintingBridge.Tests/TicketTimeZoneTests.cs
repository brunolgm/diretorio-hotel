using System.Globalization;
using System.Text.Json;
using LibGuest.PrintingBridge.Printing;

namespace LibGuest.PrintingBridge.Tests;

internal static partial class Program
{
    private static void TicketTimeZoneTests()
    {
        var instant = DateTimeOffset.Parse("2026-11-10T01:39:00Z", CultureInfo.InvariantCulture);
        var local = TimeZoneInfo.FindSystemTimeZoneById("America/Recife");
        var snapshot = new Dictionary<string, object?> { ["payload_version"] = 1, ["renderer_version"] = 1, ["lines"] = Array.Empty<object>(), ["fulfilment"] = "pickup" };
        JsonElement Data() => JsonSerializer.SerializeToElement(snapshot);
        var zone = TicketRendererV1.TimestampZone(Data(), "test", local);
        Check(TimeZoneInfo.ConvertTime(instant, zone).ToString("dd/MM/yyyy HH:mm:ss zzz", CultureInfo.InvariantCulture) == "09/11/2026 22:39:00 -03:00", "test ticket without timezone uses onsite local date across UTC midnight");
        foreach (var kind in new[] { "order", "reprint", "cancellation" })
            Check(TicketRendererV1.TimestampZone(Data(), kind, local).Equals(TimeZoneInfo.Utc), "missing operational timezone preserves previous UTC fallback " + kind);
        snapshot["timezone"] = "UTC";
        Check(TicketRendererV1.TimestampZone(Data(), "test", local).Equals(TimeZoneInfo.Utc), "explicit snapshot timezone overrides test local fallback");
        snapshot["timezone"] = "America/Recife";
        Check(TimeZoneInfo.ConvertTime(instant, TicketRendererV1.TimestampZone(Data(), "order", TimeZoneInfo.Utc)).Offset == TimeSpan.FromHours(-3), "operational snapshot timezone stays authoritative independent of Windows");
        snapshot.Remove("timezone");
        var root = JsonSerializer.SerializeToElement(new { kind = "test", snapshot, routing = new { allow_name = false, allow_room = false, allow_notes = false }, spooler = new { device_id = Guid.NewGuid(), destination_id = Guid.NewGuid() } });
        var rendered = TicketRendererV1.Render(root, new(Guid.NewGuid(), 1, "LAB_UNIT_NEVER_SUBMITTED", "Hotel de teste", "Cozinha", instant), instant);
        var expected = TimeZoneInfo.ConvertTime(instant, TimeZoneInfo.Local).ToString("dd/MM/yyyy HH:mm:ss zzz", CultureInfo.InvariantCulture);
        Check(rendered.Lines.Any(line => line.Contains(expected)), "real test renderer applies Windows local timezone to Cloud creation instant");
    }
}
