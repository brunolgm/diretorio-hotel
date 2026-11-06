using System.Globalization;

namespace LibGuest.PrintingBridge.Printing;

public sealed record PositionedTicketRow(TicketRow Style, string Text, int X, int Y, int Height, int Width, int Page);

/// <summary>One measured layout for GDI and previews; no device I/O or persistent PII.</summary>
public static class ThermalLayoutV1
{
    public const int PaperMillimeters = 80;
    public static IReadOnlyList<PositionedTicketRow> Arrange(TicketV1 ticket, int dpiX, int dpiY, int printableWidth, int printableHeight, Func<TicketRow, string, int> measure, Func<TicketRow, int>? lineHeight = null)
    {
        if (dpiX <= 0 || dpiY <= 0 || printableWidth <= 0 || printableHeight <= 0) throw new BridgeFault("spooler_page_invalid");
        var marginX = Math.Max(1, (int)Math.Ceiling(dpiX * 3 / 25.4));
        var marginY = Math.Max(1, (int)Math.Ceiling(dpiY * 3 / 25.4));
        var width = Math.Min(printableWidth, (int)Math.Floor(dpiX * PaperMillimeters / 25.4));
        var result = new List<PositionedTicketRow>(); var y = marginY; var page = 0;
        if (ticket.Rows.Count > 1000 || ticket.Rows.Sum(r => r.Text.Length) > 60000) throw new BridgeFault("renderer_content_oversized");
        foreach (var row in ticket.Rows)
        {
            if (row.Points is < 8 or > 20 || row.Indent is < 0 or > 2) throw new BridgeFault("spooler_page_invalid");
            var left = marginX + row.Indent * marginX;
            var available = width - marginX - left;
            var inkHeight = lineHeight?.Invoke(row) ?? (int)Math.Ceiling(dpiY * row.Points / 72d);
            if (inkHeight <= 0) throw new BridgeFault("spooler_page_invalid");
            var height = inkHeight + Math.Max(2, dpiY / 50);
            if (available < 1 || printableHeight - 2 * marginY < height) throw new BridgeFault("spooler_page_invalid");
            foreach (var text in Wrap(row, available, measure))
            {
                var measured = measure(row, text);
                if (measured < 0 || measured > available) throw new BridgeFault("spooler_page_invalid");
                if (y + height > printableHeight - marginY) { page++; y = marginY; }
                if (page >= 30 || result.Count >= 8000) throw new BridgeFault("renderer_content_oversized");
                var x = row.Center ? left + (available - measured) / 2 : left;
                result.Add(new(row, text, x, y, height, measured, page)); y += height;
            }
        }
        if (result.Count == 0) throw new BridgeFault("spooler_page_invalid");
        return result;
    }

    private static IEnumerable<string> Wrap(TicketRow row, int width, Func<TicketRow, string, int> measure)
    {
        var text = row.Text;
        if (text.Length == 0) { yield return ""; yield break; }
        var boundaries = StringInfo.ParseCombiningCharacters(text); var start = 0;
        while (start < boundaries.Length)
        {
            var low = start + 1; var high = boundaries.Length; var fit = start;
            while (low <= high)
            {
                var middle = (low + high) / 2; var end = middle == boundaries.Length ? text.Length : boundaries[middle];
                if (measure(row, text[boundaries[start]..end]) <= width) { fit = middle; low = middle + 1; } else high = middle - 1;
            }
            if (fit == start) throw new BridgeFault("spooler_page_invalid");
            // Prefer word boundaries; split an oversized word only at grapheme boundaries.
            if (fit < boundaries.Length)
                for (var n = fit; n > start; n--) if (text[boundaries[n]] == ' ') { fit = n; break; }
            var last = fit == boundaries.Length ? text.Length : boundaries[fit];
            yield return text[boundaries[start]..last]; start = fit;
            while (start < boundaries.Length && text[boundaries[start]] == ' ') start++;
        }
    }
}
