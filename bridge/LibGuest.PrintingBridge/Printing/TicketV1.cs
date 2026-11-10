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
public sealed record TicketRow(string Text, int Points = 10, bool Bold = false, bool Center = false, int Indent = 0);
public sealed record TicketV1(string DocumentName, IReadOnlyList<string> Lines)
{
    public IReadOnlyList<TicketRow> Rows { get; init; } = Lines.Select(text => new TicketRow(text)).ToArray();
}
public static class TicketRendererV1
{
    internal static TimeZoneInfo TimestampZone(JsonElement snapshot, string? kind, TimeZoneInfo localZone)
    {
        // Diagnostic tests have no order timezone; show the onsite Bridge's local clock.
        // Operational documents continue to prefer their frozen canonical timezone.
        var fallback = kind == "test" ? localZone : TimeZoneInfo.Utc;
        if (snapshot.TryGetProperty("timezone", out var timezone) && timezone.ValueKind == JsonValueKind.String)
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(timezone.GetString()!); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return fallback;
    }
    public static string Clean(string? value, int maximum = 2000)
    {
        var text = (value ?? "").Normalize(NormalizationForm.FormC); if (text.Length > maximum) throw new BridgeFault("renderer_content_oversized"); text = text.Replace('\r', ' ').Replace('\n', ' ').Replace('\t', ' ');
        return string.Concat(text.EnumerateRunes().Where(r => r.Value >= 32 && r.Value is not (127 or 0x202A or 0x202B or 0x202C or 0x202D or 0x202E or 0x2066 or 0x2067 or 0x2068 or 0x2069)).Select(r => r.ToString()));
    }
    public static TicketV1 Render(JsonElement root, SpoolerDestination destination, DateTimeOffset now)
    {
        var snapshot = root.GetProperty("snapshot"); if (snapshot.GetProperty("payload_version").GetInt32() != 1 || snapshot.GetProperty("renderer_version").GetInt32() != 1) throw new BridgeFault("version_incompatible");
        var kind = root.GetProperty("kind").GetString(); var rows = new List<TicketRow>();
        void Add(string text, int points = 10, bool bold = false, bool center = false, int indent = 0) => rows.Add(new(Clean(text), points, bold, center, indent));
        void Rule() => Add("--------------------------------", 9, center: true);
        Add("LibGuest", 14, true, true); Add(Clean(destination.Hotel, 200), 12, true, true); Rule();
        var reference = snapshot.TryGetProperty("reference", out var referenceValue) ? Clean(referenceValue.GetString(), 40) : "";
        if (kind != "test" && !System.Text.RegularExpressions.Regex.IsMatch(reference, "^[0-9A-F]{8}$")) throw new BridgeFault("renderer_reference_invalid");
        if (kind == "reprint") Add("REIMPRESSÃO", 16, true, true);
        var cancellation = kind == "cancellation" || snapshot.TryGetProperty("document_kind", out var documentKind) && documentKind.GetString() == "cancellation";
        string? cancellationReason = null;
        if (kind == "test") { Add("TESTE DE IMPRESSÃO", 16, true, true); Add("NÃO É PEDIDO", 14, true, true); }
        else if (cancellation) { Add("X CANCELADO X", 18, true, true); Add("PEDIDO Nº " + reference, 14, true, true); }
        else { Add("PEDIDO", 14, true, true); Add("Nº " + reference, 18, true, true); }
        if (cancellation)
        {
            if (!snapshot.TryGetProperty("cancelled_at", out var cancelledAt)) throw new BridgeFault("renderer_cancellation_invalid");
            var reason = snapshot.GetProperty("cancellation_reason_code").GetString();
            cancellationReason = reason switch { "guest_request" => "Hóspede contatou o hotel", "unavailable" => "Indisponibilidade", "operational" => "Motivo operacional", "other" => "Outro motivo registrado pela equipe", _ => throw new BridgeFault("renderer_cancellation_invalid") };
        }
        var createdAt = snapshot.TryGetProperty("created_at", out var created) ? created.GetDateTimeOffset() : destination.CreatedAt;
        if (cancellation) createdAt = snapshot.GetProperty("cancelled_at").GetDateTimeOffset();
        string? timestamp = null;
        if (createdAt is DateTimeOffset time)
        {
            var zone = TimestampZone(snapshot, kind, TimeZoneInfo.Local);
            timestamp = TimeZoneInfo.ConvertTime(time, zone).ToString("dd/MM/yyyy HH:mm:ss zzz", CultureInfo.InvariantCulture);
        }
        var routing = root.GetProperty("routing"); var privateAllowed = kind != "test" && root.TryGetProperty("private", out var privateDataValue) && privateDataValue.TryGetProperty("expired", out var expired) && expired.ValueKind == JsonValueKind.False && privateDataValue.TryGetProperty("expires_at", out var expiry) && expiry.GetDateTimeOffset() > now;
        var privateData = root.TryGetProperty("private", out var privateValue) ? privateValue : default;
        bool Allowed(string field) => routing.TryGetProperty(field, out var flag) && flag.ValueKind == JsonValueKind.True;
        string Private(string field) => privateAllowed && privateData.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.String ? Clean(v.GetString()) : "";
        var delivery = snapshot.TryGetProperty("fulfilment", out var fulfilment) && fulfilment.GetString() == "room_delivery";
        if (kind == "test")
        {
            // Technical identifiers already in the authorized envelope; no protocol extension or PII.
            var context = root.GetProperty("spooler");
            foreach (var field in new[] { ("destination_id", "Destino: "), ("device_id", "Bridge: ") })
                if (context.TryGetProperty(field.Item1, out var value) && value.ValueKind == JsonValueKind.String) Add(field.Item2 + Clean(value.GetString(), 120));
            Add("Fila: " + Clean(destination.Queue, 120));
        }
        else
        {
            if (Allowed("allow_name") && privateAllowed && privateData.TryGetProperty("name_enabled", out var name) && name.ValueKind == JsonValueKind.True) { var guest = (Private("first_name") + " " + Private("last_name")).Trim(); if (guest.Length > 0) Add("Hóspede: " + guest, 12, true); }
            Add(delivery ? Allowed("allow_room") && Private("room_label").Length > 0 ? "Quarto: " + Private("room_label") : "Entrega: Quarto (dados indisponíveis)" : "Entrega: Retirada", 12, true);
        }
        if (timestamp is not null) Add((cancellation ? "Cancelado em: " : "Data: ") + timestamp);
        Add("Setor: " + (snapshot.TryGetProperty("sector_name", out var sector) ? Clean(sector.GetString(), 120) : destination.Sector), 12, true); Rule();
        var notes = privateAllowed && Allowed("allow_notes") && privateData.TryGetProperty("line_notes", out var noteArray) && noteArray.ValueKind == JsonValueKind.Array ? noteArray.EnumerateArray().ToArray() : [];
        var renderedNotes = new HashSet<string>(); decimal total = 0;
        foreach (var item in kind == "test" ? [] : snapshot.GetProperty("lines").EnumerateArray().ToArray())
        {
            if (rows.Count > 500) throw new BridgeFault("renderer_content_oversized");
            if (item.TryGetProperty("combo_context", out var combo) && combo.ValueKind == JsonValueKind.String) Add("Combo: " + Clean(combo.GetString(), 120));
            var quantity = item.GetProperty("quantity").GetDecimal(); if (quantity <= 0 || quantity > 10000) throw new BridgeFault("renderer_quantity_invalid");
            total += quantity; Add(quantity.ToString(CultureInfo.InvariantCulture) + " x " + Clean(item.GetProperty("name").GetString(), 120), 12, true);
            foreach (var option in item.GetProperty("options").EnumerateArray()) Add(Clean(option.GetProperty("group_name").GetString(), 120) + ": " + Clean(option.GetProperty("name").GetString(), 120) + (option.TryGetProperty("quantity", out var q) ? " x" + q.GetDecimal().ToString(CultureInfo.InvariantCulture) : ""), indent: 1);
            foreach (var n in notes.Where(n => n.GetProperty("line_id").GetString() == item.GetProperty("line_id").GetString() || item.TryGetProperty("parent_id", out var parent) && parent.ValueKind == JsonValueKind.String && n.GetProperty("line_id").GetString() == parent.GetString())) if (renderedNotes.Add(n.GetProperty("line_id").GetString()!)) Add("Obs.: " + Clean(n.GetProperty("note").GetString()), indent: 1);
        }
        if (Allowed("allow_notes") && Private("note").Length > 0) Add("Obs. do pedido: " + Private("note"));
        if (kind != "test")
        {
            Rule(); Add("Total de itens: " + total.ToString(CultureInfo.InvariantCulture), 11, true);
            if (cancellation) { Add("MOTIVO DO CANCELAMENTO:", 11, true); Add(cancellationReason!); }
            Rule(); Add(cancellation ? "NÃO PREPARAR" : "PREPARAR", 18, true, true);
        }
        if (rows.Count > 1000 || rows.Sum(l => l.Text.Length) > 60000) throw new BridgeFault("renderer_content_oversized");
        return new("LibGuest " + (kind == "test" ? "TESTE" : kind == "reprint" ? "REIMPRESSAO " + (cancellation ? "CANCELAMENTO " : "") + reference : cancellation ? "CANCELAMENTO " + reference : reference), rows.Select(r => r.Text).ToArray()) { Rows = rows.ToArray() };
    }
}
