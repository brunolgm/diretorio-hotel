using System.Globalization;
using System.Text;
using System.Text.Json;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge.Printing;

public sealed record SpoolerDestination(Guid PrinterId, int Revision, string Queue, string Hotel, string Sector = "", DateTimeOffset? CreatedAt = null)
{
    public static SpoolerDestination Read(JsonElement root, Guid device, JournalJob job)
    {
        var parsed = JobEnvelope.Parse(root) ?? throw new BridgeFault("authorization_invalid"); try { Journal.Match(job, parsed); } finally { System.Security.Cryptography.CryptographicOperations.ZeroMemory(parsed.Content); }
        if (!parsed.Authorized || !parsed.DispatchRecorded || parsed.State != "dispatching") throw new BridgeFault("authorization_invalid");
        var c = root.GetProperty("spooler"); var r = root.GetProperty("routing"); var p = r.GetProperty("printer");
        if (c.GetProperty("version").GetInt32() != 1 || c.GetProperty("device_id").GetGuid() != device || p.GetProperty("device_id").GetGuid() != device || c.GetProperty("destination_id").GetGuid() != root.GetProperty("destination_id").GetGuid() || p.GetProperty("destination_id").GetGuid() != c.GetProperty("destination_id").GetGuid() || p.GetProperty("adapter").GetString() != "windows_spooler" || !p.GetProperty("active").GetBoolean() || c.GetProperty("destination_revision").GetInt32() != r.GetProperty("destination_revision").GetInt32()) throw new BridgeFault("spooler_destination_invalid");
        var id = c.GetProperty("printer_id").GetGuid(); var revision = c.GetProperty("printer_revision").GetInt32(); var queue = c.GetProperty("queue_name").GetString() ?? "";
        if (id == Guid.Empty || id != p.GetProperty("id").GetGuid() || revision < 1 || revision != p.GetProperty("revision").GetInt32() || !ValidQueue(queue) || queue != p.GetProperty("config").GetProperty("queue_name").GetString()) throw new BridgeFault("spooler_destination_invalid");
        var hotel = TicketRendererV1.Clean(c.GetProperty("hotel_name").GetString(), 120); if (hotel.Length == 0) throw new BridgeFault("spooler_destination_invalid"); return new(id, revision, queue, hotel, c.TryGetProperty("sector_name", out var sector) ? TicketRendererV1.Clean(sector.GetString(), 120) : "", c.TryGetProperty("created_at", out var created) ? created.GetDateTimeOffset() : null);
    }
    public static bool ValidQueue(string value) => value.Length is > 0 and <= 120 && value == value.Trim() && !value.Any(c => char.IsControl(c) || c is '\\' or '/' or '<' or '>');
}
public sealed record TicketV1(string DocumentName, IReadOnlyList<string> Lines);
public static class TicketRendererV1
{
    public static string Clean(string? value, int maximum = 2000)
    {
        var text = (value ?? "").Normalize(NormalizationForm.FormC); if (text.Length > maximum) throw new BridgeFault("renderer_content_oversized"); text = text.Replace('\r', ' ').Replace('\n', ' ').Replace('\t', ' ');
        return string.Concat(text.EnumerateRunes().Where(r => r.Value >= 32 && r.Value is not (127 or 0x202A or 0x202B or 0x202C or 0x202D or 0x202E or 0x2066 or 0x2067 or 0x2068 or 0x2069)).Select(r => r.ToString()));
    }
    public static TicketV1 Render(JsonElement root, SpoolerDestination destination, DateTimeOffset now)
    {
        var snapshot = root.GetProperty("snapshot"); if (snapshot.GetProperty("payload_version").GetInt32() != 1 || snapshot.GetProperty("renderer_version").GetInt32() != 1) throw new BridgeFault("version_incompatible");
        var kind = root.GetProperty("kind").GetString(); var lines = new List<string> { destination.Hotel };
        var reference = snapshot.TryGetProperty("reference", out var referenceValue) ? Clean(referenceValue.GetString(), 40) : "";
        if (kind != "test" && !System.Text.RegularExpressions.Regex.IsMatch(reference, "^[0-9A-F]{8}$")) throw new BridgeFault("renderer_reference_invalid");
        if (kind == "test") { lines.Add("LIBGUEST"); lines.Add("TESTE DE IMPRESSÃO"); lines.Add("TESTE LIBGUEST — NÃO É PEDIDO"); }
        else { if (kind == "reprint") lines.Add("REIMPRESSÃO"); lines.Add("Pedido " + reference); }
        var cancellation = kind == "cancellation" || snapshot.TryGetProperty("document_kind", out var documentKind) && documentKind.GetString() == "cancellation";
        if (cancellation)
        {
            lines.Insert(1, "CANCELAMENTO");
            if (!snapshot.TryGetProperty("cancelled_at", out var cancelledAt)) throw new BridgeFault("renderer_cancellation_invalid");
            lines.Add("Cancelado em: " + cancelledAt.GetDateTimeOffset().ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss 'UTC'", CultureInfo.InvariantCulture));
            var reason = snapshot.GetProperty("cancellation_reason_code").GetString();
            lines.Add("Motivo: " + (reason switch { "guest_request" => "Hóspede contatou o hotel", "unavailable" => "Indisponibilidade", "operational" => "Operacional", "other" => "Outro motivo registrado pela equipe", _ => throw new BridgeFault("renderer_cancellation_invalid") }));
        }
        var createdAt = snapshot.TryGetProperty("created_at", out var created) ? created.GetDateTimeOffset() : destination.CreatedAt;
        if (createdAt is DateTimeOffset time)
        {
            var zone = TimeZoneInfo.Utc; if (snapshot.TryGetProperty("timezone", out var timezone) && timezone.ValueKind == JsonValueKind.String) { try { zone = TimeZoneInfo.FindSystemTimeZoneById(timezone.GetString()!); } catch (TimeZoneNotFoundException) { } catch (InvalidTimeZoneException) { } }
            lines.Add(TimeZoneInfo.ConvertTime(time, zone).ToString("yyyy-MM-dd HH:mm:ss zzz", CultureInfo.InvariantCulture) + " " + zone.Id);
        }
        lines.Add("Setor: " + (snapshot.TryGetProperty("sector_name", out var sector) ? Clean(sector.GetString(), 120) : destination.Sector));
        var routing = root.GetProperty("routing"); var privateAllowed = root.TryGetProperty("private", out var privateData) && privateData.TryGetProperty("expired", out var expired) && !expired.GetBoolean() && privateData.TryGetProperty("expires_at", out var expiry) && expiry.GetDateTimeOffset() > now;
        bool Allowed(string field) => routing.TryGetProperty(field, out var flag) && flag.ValueKind == JsonValueKind.True;
        string Private(string field) => privateAllowed && privateData.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String ? Clean(v.GetString()) : "";
        var delivery = snapshot.TryGetProperty("fulfilment", out var fulfilment) && fulfilment.GetString() == "room_delivery";
        lines.Add(delivery ? Allowed("allow_room") && Private("room_label").Length > 0 ? "Apartamento: " + Private("room_label") : "Entrega no apartamento — dados privados indisponíveis" : "RETIRADA NO LOCAL");
        if (Allowed("allow_name") && privateAllowed && privateData.TryGetProperty("name_enabled", out var name) && name.ValueKind == JsonValueKind.True) { var guest = (Private("first_name") + " " + Private("last_name")).Trim(); if (guest.Length > 0) lines.Add("Nome: " + guest); }
        var notes = privateAllowed && Allowed("allow_notes") && privateData.TryGetProperty("line_notes", out var noteArray) && noteArray.ValueKind == JsonValueKind.Array ? noteArray.EnumerateArray().ToArray() : [];
        var renderedNotes = new HashSet<string>();
        foreach (var item in snapshot.GetProperty("lines").EnumerateArray())
        {
            if (lines.Count > 500) throw new BridgeFault("renderer_content_oversized");
            if (item.TryGetProperty("combo_context", out var combo) && combo.ValueKind == JsonValueKind.String) lines.Add("Combo: " + Clean(combo.GetString(), 120));
            var quantity = item.GetProperty("quantity").GetDecimal(); if (quantity <= 0 || quantity > 10000) throw new BridgeFault("renderer_quantity_invalid");
            lines.Add(quantity.ToString(CultureInfo.InvariantCulture) + " × " + Clean(item.GetProperty("name").GetString(), 120));
            foreach (var option in item.GetProperty("options").EnumerateArray()) lines.Add("  " + Clean(option.GetProperty("group_name").GetString(), 120) + ": " + Clean(option.GetProperty("name").GetString(), 120) + (option.TryGetProperty("quantity", out var q) ? " ×" + q.GetDecimal().ToString(CultureInfo.InvariantCulture) : ""));
            foreach (var n in notes.Where(n => n.GetProperty("line_id").GetString() == item.GetProperty("line_id").GetString() || item.TryGetProperty("parent_id", out var parent) && parent.ValueKind == JsonValueKind.String && n.GetProperty("line_id").GetString() == parent.GetString())) if (renderedNotes.Add(n.GetProperty("line_id").GetString()!)) lines.Add("  Observação: " + Clean(n.GetProperty("note").GetString()));
        }
        if (Allowed("allow_notes") && Private("note").Length > 0) lines.Add("Observação do pedido: " + Private("note"));
        if (lines.Count > 1000 || lines.Sum(l => l.Length) > 60000) throw new BridgeFault("renderer_content_oversized");
        return new("LibGuest " + (kind == "test" ? "TESTE" : kind == "reprint" ? "REIMPRESSAO " + (cancellation ? "CANCELAMENTO " : "") + reference : cancellation ? "CANCELAMENTO " + reference : reference), lines);
    }
}
