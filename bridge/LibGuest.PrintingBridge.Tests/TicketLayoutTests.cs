using System.Globalization;
using System.Text.Json;
using System.Runtime.InteropServices;
using System.Xml.Linq;

using LibGuest.PrintingBridge.Printing;

[assembly: DefaultDllImportSearchPaths(DllImportSearchPath.System32)]

namespace LibGuest.PrintingBridge.Tests;
internal static partial class Program
{
    private static void TicketLayoutTests()
    {
        var now = DateTimeOffset.Parse("2026-11-05T15:45:00Z", CultureInfo.InvariantCulture);
        var leaf = Guid.NewGuid(); var parent = Guid.NewGuid(); var device = Guid.NewGuid();
        var fixtures = new Dictionary<string, object?>
        {
            ["kind"] = "order", ["routing"] = new { allow_name = true, allow_room = true, allow_notes = true },
            ["spooler"] = new { destination_id = Guid.NewGuid(), device_id = device },
            ["private"] = new { expired = false, expires_at = now.AddMinutes(15), name_enabled = true, first_name = "Hóspede", last_name = "Sintético Áçê", room_label = "LAB-402", note = "Observação sintética do pedido", email = "NEVER_RENDER_EMAIL", line_notes = new[] { new { line_id = parent, note = "Sem cebola — atenção à alergia" } } }
        };
        Dictionary<string, object?> Snapshot(string fulfilment = "room_delivery") => new()
        {
            ["payload_version"] = 1, ["renderer_version"] = 1, ["reference"] = "A1B2C3D4", ["created_at"] = now.AddMinutes(-5),
            ["timezone"] = "America/Recife", ["sector_name"] = "Cozinha LAB", ["fulfilment"] = fulfilment,
            ["lines"] = new object[] {
                new { line_id = leaf, parent_id = parent, name = "Prato sintético com nome longo, ação, coração e informações complementares", quantity = 2, options = new[] { new { group_name = "Acompanhamento", name = "Arroz integral", quantity = 2 } } },
                new { line_id = Guid.NewGuid(), name = "Bebida sintética", quantity = 1, options = Array.Empty<object>() }
            }
        };
        var snapshot = Snapshot(); fixtures["snapshot"] = snapshot;
        TicketV1 Render(string hotel = "Hotel de fixture", DateTimeOffset? time = null) => TicketRendererV1.Render(JsonSerializer.SerializeToElement(fixtures), new(Guid.NewGuid(), 1, "LAB_UNIT_NEVER_SUBMITTED", hotel, "Cozinha LAB", now), time ?? now);
        string Text(TicketV1 ticket) => string.Join('\n', ticket.Lines);
        var order = Render(); var text = Text(order);
        Check(order.Rows[0] is { Text: "LibGuest", Center: true, Bold: true } && order.Rows[1] is { Text: "Hotel de fixture", Center: true }, "Layout V1 centered dynamic header without outlet");
        Check(order.Rows.Single(r => r.Text == "Nº A1B2C3D4") is { Bold: true, Points: 18, Center: true }, "Layout V1 emphasizes real frozen order reference");
        Check(text.Contains("Hóspede: Hóspede Sintético Áçê") && text.Contains("Quarto: LAB-402") && !order.DocumentName.Contains("Sintético") && !text.Contains("NEVER_RENDER"), "Layout V1 authorized name and room on paper, no extra private fields or PII title");
        Check(order.Rows.Any(r => r.Text.StartsWith("2 x Prato") && r.Bold) && order.Rows.Any(r => r.Text == "Acompanhamento: Arroz integral x2" && r.Indent == 1), "Layout V1 quantity and modifiers are frozen, no extra multiplication");
        Check(text.Contains("Total de itens: 3") && order.Lines[^1] == "PREPARAR" && !text.Contains("R$") && !text.Contains("US$"), "Layout V1 sums sector quantities and preserves existing no-price operational behavior");
        Check(text.Contains("05/11/2026 12:40:00 -03:00") && text.Contains("Setor: Cozinha LAB") && text.Contains("Sem cebola"), "Layout V1 frozen date timezone sector and permitted parent note");
        Check(!Text(Render(time: now.AddHours(1))).Contains("Sintético Áçê") && !Text(Render(time: now.AddHours(1))).Contains("LAB-402") && !Text(Render(time: now.AddHours(1))).Contains("alergia"), "Layout V1 expiration omits name room and private notes");
        fixtures["routing"] = new { allow_name = false, allow_room = false, allow_notes = false };
        Check(!Text(Render()).Contains("Sintético Áçê") && !Text(Render()).Contains("LAB-402") && !Text(Render()).Contains("alergia"), "Layout V1 cannot bypass frozen routing PII permissions");
        fixtures["routing"] = new { allow_name = true, allow_room = true, allow_notes = true };
        var privateOriginal = fixtures["private"]; fixtures["private"] = new { expired = false, expires_at = now.AddMinutes(15), name_enabled = false, first_name = "FORBIDDEN_NAME" };
        Check(!Text(Render()).Contains("FORBIDDEN_NAME"), "Layout V1 respects live name_enabled false");
        fixtures["private"] = new { expired = true, expires_at = now.AddMinutes(15), name_enabled = true, first_name = "FORBIDDEN_NAME" };
        Check(!Text(Render()).Contains("FORBIDDEN_NAME"), "Layout V1 expired marker overrides a future timestamp");
        fixtures["private"] = new { expired = false, name_enabled = true, first_name = "FORBIDDEN_NAME" };
        Check(!Text(Render()).Contains("FORBIDDEN_NAME"), "Layout V1 missing expiry cannot revive PII");
        fixtures.Remove("private"); Check(!Text(Render()).Contains("Hóspede:"), "Layout V1 missing name is omitted rather than reconstructed"); fixtures["private"] = privateOriginal;
        snapshot["fulfilment"] = "pickup"; Check(Text(Render()).Contains("Entrega: Retirada") && !Text(Render()).Contains("LAB-402"), "Layout V1 pickup never leaks room"); snapshot["fulfilment"] = "room_delivery";
        fixtures["kind"] = "reprint";
        Check(Render().Rows.Any(r => r.Text == "REIMPRESSÃO" && r.Bold && r.Points >= 16) && Render().Lines[^1] == "PREPARAR", "Layout V1 original reprint retains content and prominent warning");
        fixtures["kind"] = "cancellation"; snapshot["document_kind"] = "cancellation"; snapshot["cancelled_at"] = now; snapshot["cancellation_reason_code"] = "guest_request";
        var cancel = Render();
        Check(cancel.Rows.Any(r => r.Text == "X CANCELADO X" && r.Bold && r.Points == 18) && cancel.Lines[^1] == "NÃO PREPARAR" && !cancel.Lines.Contains("PREPARAR"), "Layout V1 cancellation has separate prominent safety labels");
        Check(Text(cancel).Contains("PEDIDO Nº A1B2C3D4") && Text(cancel).Contains("Cancelado em: 05/11/2026 12:45:00 -03:00") && Text(cancel).Contains("MOTIVO DO CANCELAMENTO:\nHóspede contatou o hotel") && Text(cancel).Contains("Total de itens: 3"), "Layout V1 cancellation preserves reference items and human reason from snapshot");
        foreach (var reason in new[] { ("operational", "Motivo operacional"), ("unavailable", "Indisponibilidade"), ("other", "Outro motivo registrado pela equipe") }) { snapshot["cancellation_reason_code"] = reason.Item1; Check(Text(Render()).Contains(reason.Item2), "Layout V1 reason " + reason.Item1); }
        snapshot["cancellation_reason_code"] = "unrecognized"; Denied(() => Render(), "Layout V1 unknown cancellation reason fails closed"); snapshot["cancellation_reason_code"] = "operational";
        fixtures["kind"] = "reprint"; var reprintCancel = Render();
        Check(new[] { "REIMPRESSÃO", "X CANCELADO X", "NÃO PREPARAR" }.All(reprintCancel.Lines.Contains), "Layout V1 cancellation reprint shows all three mandatory warnings together");
        Check(!Text(Render(time: now.AddDays(1))).Contains("Sintético Áçê"), "Layout V1 cancellation reprint cannot reconstruct expired name");
        fixtures["kind"] = "test"; fixtures["snapshot"] = Snapshot(); var test = Render();
        Check(new[] { "TESTE DE IMPRESSÃO", "NÃO É PEDIDO" }.All(test.Lines.Contains) && Text(test).Contains("Destino:") && Text(test).Contains("Bridge:") && Text(test).Contains("Fila: LAB_UNIT_NEVER_SUBMITTED") && Text(test).Contains("Setor:"), "Layout V1 test identifies destination sector bridge queue without protocol changes");
        Check(!Text(test).Contains("Sintético Áçê") && !Text(test).Contains("LAB-402") && !Text(test).Contains("alergia") && !Text(test).Contains("2 x Prato") && !test.Lines.Contains("PREPARAR"), "Layout V1 test never includes guest PII or operational order lines");
        fixtures["kind"] = "order"; fixtures["snapshot"] = Snapshot();
        foreach (var hotel in new[] { "Bugan Recife", "Grand Mercure Copacabana", "Novotel Leme", "Novotel Salvador Rio Vermelho", "Mercure Rio Boutique Copacabana", "Default técnico" })
        {
            Check(Render(hotel).Lines[1] == hotel && Render(hotel).Lines[0] == "LibGuest", "Layout V1 shared dynamic hotel header " + hotel);
            var geometry = ThermalLayoutV1.Arrange(Render(hotel), 203, 203, 588, 2448, (row, value) => new StringInfo(value).LengthInTextElements * 12);
            Check(geometry.All(row => row.X + row.Width <= 564), "Layout V1 dynamic hotel header fits narrow printable area " + hotel);
        }
        var onlyOne = Snapshot(); onlyOne["sector_name"] = "Bar LAB"; onlyOne["lines"] = new[] { new { line_id = Guid.NewGuid(), name = "Only bar / Sólo bar", quantity = 1, options = Array.Empty<object>() } }; fixtures["snapshot"] = onlyOne;
        Check(!Text(Render()).Contains("Prato") && !Text(Render()).Contains("alergia") && Text(Render()).Contains("Total de itens: 1"), "Layout V1 renders only authorized sector lines without adding another sector or note");
        fixtures["snapshot"] = Snapshot();
        // Real Windows GDI font metrics in a memory DC; no queue, printer DC or StartDoc.
        using var metrics = new TicketMetrics();
        int Measure(TicketRow row, string value) => metrics.Measure(row, value);
        foreach (var fixture in new[] { order, cancel, reprintCancel, test, Render(new string('X', 110) + " Áção / información") })
        {
            var layout = ThermalLayoutV1.Arrange(fixture, 203, 203, 640, 2200, Measure, metrics.Height);
            Check(layout.All(r => r.X >= 24 && r.X + r.Width <= 615 && r.Y >= 24 && r.Y + r.Height <= 2176), "Layout V1 all measured rows stay inside 80mm 203dpi bounds " + fixture.DocumentName);
            Check(layout.Any(r => r.Style.Bold) && layout.Any(r => r.Style.Center) && layout.All(r => !r.Text.Any(char.IsControl)), "Layout V1 text-only hierarchy and sanitized Unicode " + fixture.DocumentName);
        }
        var wide = new TicketV1("Fixture", new[] { "Sopa / Soup / Sopa — ação, corazón, crème e 🥗", new string('W', 300) });
        var typicalPrintable = ThermalLayoutV1.Arrange(order, 203, 203, 576, 2200, Measure, metrics.Height);
        Check(typicalPrintable.All(r => r.X >= 24 && r.X + r.Width <= 552) && typicalPrintable.Any(r => r.Style.Text.StartsWith("2 x Prato") && r.Text != r.Style.Text), "Layout V1 respects a narrower printable area on 80mm stock and wraps long item names");
        var longSnapshot = Snapshot(); longSnapshot["lines"] = new[] { new { line_id = leaf, name = "Long item / Producto largo", quantity = 1, options = new[] { new { group_name = new string('G', 120), name = new string('W', 120), quantity = 1 } } } };
        fixtures["snapshot"] = longSnapshot; fixtures["private"] = new { expired = false, expires_at = now.AddMinutes(15), note = string.Concat(Enumerable.Repeat("Información ação café ", 40)), line_notes = new[] { new { line_id = leaf, note = string.Concat(Enumerable.Repeat("Sin cebolla / no onion ", 25)) } } };
        var longText = Render(); var longLayout = ThermalLayoutV1.Arrange(longText, 203, 203, 588, 2448, Measure, metrics.Height);
        Check(longLayout.All(r => r.X + r.Width <= 564 && r.Y + r.Height <= 2424) && longLayout.Any(r => r.Style.Indent == 1 && r.Text.Length < r.Style.Text.Length), "Layout V1 long modifiers and private notes wrap within actual LAB driver dimensions");
        Check(string.Join("", longLayout.Where(r => r.Style.Indent == 1).Select(r => r.Text)).Contains(new string('W', 120)) && Text(longText).Contains("Información ação café"), "Layout V1 long EN ES and PT content survives wrapping without truncation");
        fixtures["private"] = privateOriginal; fixtures["snapshot"] = Snapshot();
        var wrapped = ThermalLayoutV1.Arrange(wide, 203, 203, 400, 180, Measure);
        Check(wrapped.Any(r => r.Page > 0) && wrapped.Any(r => r.Text.Contains("🥗")) && wrapped.All(r => r.Text.EnumerateRunes().All(rune => rune.Value != 0xfffd)), "Layout V1 narrow-driver wrapping paginates without broken Unicode surrogate pairs");
        Denied(() => ThermalLayoutV1.Arrange(order, 203, 203, 1, 10, Measure), "Layout V1 invalid paper fails before I/O");
        Denied(() => ThermalLayoutV1.Arrange(new("Fixture", new[] { new string('W', 60001) }), 203, 203, 640, 2200, Measure), "Layout V1 bounded content fails before I/O");
        var previews = Path.Combine(root, "ticket-layout-previews"); Directory.CreateDirectory(previews);
        const int previewWidth = 588; // Observed LAB printable width; never a product default or device binding.
        foreach (var fixture in new[] { ("order", order), ("cancellation", cancel), ("reprint-cancellation", reprintCancel), ("test", test) })
        {
            var layout = ThermalLayoutV1.Arrange(fixture.Item2, 203, 203, previewWidth, 12000, Measure, metrics.Height);
            XNamespace ns = "http://www.w3.org/2000/svg";
            var svg = new XElement(ns + "svg", new XAttribute("width", previewWidth), new XAttribute("height", layout.Max(r => r.Y + r.Height) + 24), new XAttribute("viewBox", "0 0 " + previewWidth + " " + (layout.Max(r => r.Y + r.Height) + 24)),
                new XElement(ns + "title", "Fixture sintética — prévia GDI 203dpi; não confirma impressão física"),
                new XElement(ns + "rect", new XAttribute("width", "100%"), new XAttribute("height", "100%"), new XAttribute("fill", "white")),
                layout.Select(row => new XElement(ns + "text", new XAttribute("x", row.X), new XAttribute("y", row.Y + metrics.Ascent(row.Style)), new XAttribute("font-family", "Arial"), new XAttribute("font-size", Math.Ceiling(203 * row.Style.Points / 72d)), new XAttribute("font-weight", row.Style.Bold ? 700 : 400), new XAttribute("fill", "black"), row.Text)));
            File.WriteAllText(Path.Combine(previews, fixture.Item1 + ".svg"), svg.ToString());
        }
    }

    private sealed class TicketMetrics : IDisposable
    {
        [StructLayout(LayoutKind.Sequential)] private struct Extent { public int Width, Height; }
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct Metrics { public int Height, Ascent, Descent, InternalLeading, ExternalLeading, AverageWidth, MaximumWidth, Weight, Overhang, DigitizedX, DigitizedY; public char First, Last, Default, Break; public byte Italic, Underlined, StruckOut, Pitch, Charset; }
        [DllImport("gdi32.dll")] private static extern IntPtr CreateCompatibleDC(IntPtr dc);
        [DllImport("gdi32.dll", EntryPoint = "CreateDCW", CharSet = CharSet.Unicode)] private static extern IntPtr CreatePrinterDC(string driver, string device, string? output, IntPtr mode);
        [DllImport("gdi32.dll")] private static extern int GetDeviceCaps(IntPtr dc, int index);
        [DllImport("gdi32.dll")] private static extern bool DeleteDC(IntPtr dc);
        [DllImport("gdi32.dll")] private static extern IntPtr SelectObject(IntPtr dc, IntPtr value);
        [DllImport("gdi32.dll")] private static extern bool DeleteObject(IntPtr value);
        [DllImport("gdi32.dll", EntryPoint = "CreateFontW", CharSet = CharSet.Unicode)] private static extern IntPtr CreateFont(int height, int width, int escape, int orientation, int weight, uint italic, uint underline, uint strike, uint charset, uint output, uint clip, uint quality, uint family, string face);
        [DllImport("gdi32.dll", EntryPoint = "GetTextExtentPoint32W", CharSet = CharSet.Unicode)] private static extern bool MeasureText(IntPtr dc, string text, int count, out Extent size);
        [DllImport("gdi32.dll", EntryPoint = "GetTextMetricsW", CharSet = CharSet.Unicode)] private static extern bool ReadMetrics(IntPtr dc, out Metrics metrics);
        private readonly IntPtr dc = CreateCompatibleDC(IntPtr.Zero);
        private IntPtr previous;
        private readonly Dictionary<(int, bool), IntPtr> fonts = [];
        public static object PrinterMetadata(string queue)
        {
            var printerDc = CreatePrinterDC("WINSPOOL", queue, null, IntPtr.Zero); if (printerDc == IntPtr.Zero) throw new BridgeFault("preview_dc_failed");
            try { return new { queue, dpi_x = GetDeviceCaps(printerDc, 88), dpi_y = GetDeviceCaps(printerDc, 90), printable_width = GetDeviceCaps(printerDc, 8), printable_height = GetDeviceCaps(printerDc, 10), physical_width = GetDeviceCaps(printerDc, 110), offset_x = GetDeviceCaps(printerDc, 112), physical_submissions = 0 }; }
            finally { DeleteDC(printerDc); }
        }
        private void Select(TicketRow row)
        {
            if (dc == IntPtr.Zero) throw new BridgeFault("preview_dc_failed");
            if (!fonts.TryGetValue((row.Points, row.Bold), out var font))
            {
                font = CreateFont(-(int)Math.Ceiling(203 * row.Points / 72d), 0, 0, 0, row.Bold ? 700 : 400, 0, 0, 0, 1, 0, 0, 0, 0, "Arial");
                if (font == IntPtr.Zero) throw new BridgeFault("preview_font_failed"); fonts.Add((row.Points, row.Bold), font);
            }
            var old = SelectObject(dc, font); if (old == IntPtr.Zero || old == new IntPtr(-1)) throw new BridgeFault("preview_font_failed"); if (previous == IntPtr.Zero) previous = old;
        }
        public int Measure(TicketRow row, string text) { Select(row); if (!MeasureText(dc, text, text.Length, out var size)) throw new BridgeFault("preview_measure_failed"); return size.Width; }
        public int Ascent(TicketRow row) { Select(row); if (!ReadMetrics(dc, out var metrics)) throw new BridgeFault("preview_measure_failed"); return metrics.Ascent; }
        public int Height(TicketRow row) { Select(row); if (!ReadMetrics(dc, out var metrics)) throw new BridgeFault("preview_measure_failed"); return metrics.Height; }
        public void Dispose() { if (previous != IntPtr.Zero) SelectObject(dc, previous); foreach (var font in fonts.Values) DeleteObject(font); if (dc != IntPtr.Zero) DeleteDC(dc); }
    }
}
