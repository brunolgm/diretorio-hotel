using System.Runtime.InteropServices;
using System.Text.Json.Serialization;

[assembly: DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
namespace LibGuest.PrintingBridge.Printing;

public sealed record QueueObservation(bool SpoolerAvailable, bool Found, string State, uint Flags = 0, bool RetainsDocuments = false)
{
    // Zero flags is unknown hardware readiness; it can still accept a document into the spooler.
    public bool CanSubmit => SpoolerAvailable && Found && State == "unknown" && !RetainsDocuments;
}
public sealed record SpoolSubmission(bool Accepted, bool PossibleIo, int? JobId = null);
public sealed record DiscoveredQueue([property: JsonPropertyName("name")] string Name, [property: JsonPropertyName("driver")] string Driver, [property: JsonPropertyName("state")] string State);
public interface IWindowsSpooler
{
    QueueObservation Observe(string queue);
    Task<SpoolSubmission> Submit(string queue, TicketV1 ticket, Action<int> persistId, Func<bool> dispatchAllowed, CancellationToken cancellation);
}
/// <summary>Only Windows GDI/Spooler. Never a default queue, output-file command, RAW stream, shell or direct device socket.</summary>
public sealed class WindowsSpooler : IWindowsSpooler
{
    [StructLayout(LayoutKind.Sequential)] private struct Printer4 { public IntPtr Name, Server; public uint Attributes; }
    [StructLayout(LayoutKind.Sequential)] private struct Printer2 { public IntPtr Server, Name, Share, Port, Driver, Comment, Location, DevMode, Separator, Processor, Datatype, Parameters, Security; public uint Attributes, Priority, DefaultPriority, StartTime, UntilTime, Status, Jobs, AveragePpm; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct DocInfo { public int Size; public string Name; public string? Output, Datatype; public int Type; }
    [StructLayout(LayoutKind.Sequential)] private struct Size { public int Width, Height; }
    [DllImport("winspool.drv", EntryPoint = "EnumPrintersW", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool EnumPrinters(uint flags, string? name, uint level, IntPtr buffer, uint size, out uint needed, out uint returned);
    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool OpenPrinter(string name, out IntPtr printer, IntPtr defaults);
    [DllImport("winspool.drv", EntryPoint = "GetPrinterW", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetPrinter(IntPtr printer, uint level, IntPtr buffer, uint size, out uint needed);
    [DllImport("winspool.drv")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool ClosePrinter(IntPtr printer);
    [DllImport("gdi32.dll", EntryPoint = "CreateDCW", CharSet = CharSet.Unicode)] private static extern IntPtr CreateDc(string driver, string device, string? output, IntPtr mode);
    [DllImport("gdi32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool DeleteDC(IntPtr dc);
    [DllImport("gdi32.dll")] private static extern int GetDeviceCaps(IntPtr dc, int index);
    [DllImport("gdi32.dll", EntryPoint = "CreateFontW", CharSet = CharSet.Unicode)] private static extern IntPtr CreateFont(int height, int width, int escape, int orientation, int weight, uint italic, uint underline, uint strike, uint charset, uint output, uint clip, uint quality, uint family, string face);
    [DllImport("gdi32.dll")] private static extern IntPtr SelectObject(IntPtr dc, IntPtr value);
    [DllImport("gdi32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool DeleteObject(IntPtr value);
    [DllImport("gdi32.dll", EntryPoint = "StartDocW", CharSet = CharSet.Unicode)] private static extern int StartDoc(IntPtr dc, ref DocInfo info);
    [DllImport("gdi32.dll")] private static extern int EndDoc(IntPtr dc);
    [DllImport("gdi32.dll")] private static extern int AbortDoc(IntPtr dc);
    [DllImport("gdi32.dll")] private static extern int StartPage(IntPtr dc);
    [DllImport("gdi32.dll")] private static extern int EndPage(IntPtr dc);
    [DllImport("gdi32.dll", EntryPoint = "TextOutW", CharSet = CharSet.Unicode)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool TextOut(IntPtr dc, int x, int y, string text, int count);
    [DllImport("gdi32.dll", EntryPoint = "GetTextExtentPoint32W", CharSet = CharSet.Unicode)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool Measure(IntPtr dc, string text, int count, out Size size);
    [DllImport("gdi32.dll")] private static extern int SetBkMode(IntPtr dc, int mode);
    [DllImport("gdi32.dll")] private static extern uint SetTextColor(IntPtr dc, uint color);

    public static IReadOnlyList<string> LocalQueues()
    {
        // Level 4 queries the local spooler cache; no enumeration of remote servers.
        if (!OperatingSystem.IsWindows()) throw new BridgeFault("windows_required");
        EnumPrinters(2, null, 4, IntPtr.Zero, 0, out var needed, out _);
        if (needed == 0) { if (Marshal.GetLastWin32Error() is not (0 or 122)) throw new BridgeFault("spooler_unavailable"); return []; }
        if (needed > 8 * 1024 * 1024) throw new BridgeFault("spooler_metadata_oversized");
        var buffer = Marshal.AllocHGlobal(checked((int)needed));
        try { if (!EnumPrinters(2, null, 4, buffer, needed, out _, out var count) || count > needed / Marshal.SizeOf<Printer4>()) throw new BridgeFault("spooler_unavailable"); var values = new List<string>(); for (var n = 0; n < count; n++) { var row = Marshal.PtrToStructure<Printer4>(IntPtr.Add(buffer, n * Marshal.SizeOf<Printer4>())); var name = Marshal.PtrToStringUni(row.Name); if (name is not null) values.Add(name); } return values; }
        finally { Marshal.FreeHGlobal(buffer); }
    }
    public QueueObservation Observe(string queue)
    {
        if (!SpoolerDestination.ValidQueue(queue)) return new(false, false, "invalid_queue");
        try
        {
            if (!LocalQueues().Contains(queue, StringComparer.OrdinalIgnoreCase)) return new(true, false, "missing_queue");
            if (!OpenPrinter(queue, out var handle, IntPtr.Zero)) return new(true, true, "unavailable");
            try
            {
                GetPrinter(handle, 2, IntPtr.Zero, 0, out var needed); if (needed < Marshal.SizeOf<Printer2>() || needed > 1024 * 1024) return new(true, true, "unavailable"); var buffer = Marshal.AllocHGlobal((int)needed);
                try { if (!GetPrinter(handle, 2, buffer, needed, out _)) return new(true, true, "unavailable"); var p = Marshal.PtrToStructure<Printer2>(buffer); var state = (p.Status & 0x80) != 0 ? "offline" : (p.Status & 0x10) != 0 ? "paper_out" : (p.Status & 2) != 0 ? "error" : (p.Status & 1) != 0 ? "paused" : "unknown"; return new(true, true, state, p.Status, (p.Attributes & 0x100) != 0); }
                finally { Marshal.FreeHGlobal(buffer); }
            }
            finally { ClosePrinter(handle); }
        }
        catch { return new(false, false, "unavailable"); }
    }
    public IReadOnlyList<DiscoveredQueue> Discover()
    {
        var result = new List<DiscoveredQueue>();
        foreach (var queue in LocalQueues().Where(SpoolerDestination.ValidQueue).Take(64))
        {
            var driver = "";
            if (OpenPrinter(queue, out var handle, IntPtr.Zero))
            {
                try
                {
                    GetPrinter(handle, 2, IntPtr.Zero, 0, out var needed);
                    if (needed >= Marshal.SizeOf<Printer2>() && needed <= 1024 * 1024)
                    {
                        var buffer = Marshal.AllocHGlobal((int)needed);
                        try { if (GetPrinter(handle, 2, buffer, needed, out _)) driver = TicketRendererV1.Clean(Marshal.PtrToStringUni(Marshal.PtrToStructure<Printer2>(buffer).Driver), 160); }
                        finally { Marshal.FreeHGlobal(buffer); }
                    }
                }
                finally { ClosePrinter(handle); }
            }
            var observed = Observe(queue); var state = observed.SpoolerAvailable && observed.Found && !observed.RetainsDocuments && observed.State is "unknown" or "offline" or "paper_out" or "error" ? observed.State : "unavailable";
            result.Add(new(queue, driver, state));
        }
        return result;
    }
    public Task<SpoolSubmission> Submit(string queue, TicketV1 ticket, Action<int> persistId, Func<bool> dispatchAllowed, CancellationToken cancellation) => Task.Run(() => SubmitNative(queue, ticket, persistId, dispatchAllowed, cancellation), CancellationToken.None);
    private SpoolSubmission SubmitNative(string queue, TicketV1 ticket, Action<int> persistId, Func<bool> dispatchAllowed, CancellationToken cancellation)
    {
        if (!Observe(queue).CanSubmit || cancellation.IsCancellationRequested) return new(false, false);
        var dc = CreateDc("WINSPOOL", queue, null, IntPtr.Zero); if (dc == IntPtr.Zero) return new(false, false);
        IntPtr previous = IntPtr.Zero; var fonts = new Dictionary<(int, bool), IntPtr>(); var possible = false; var complete = false; int? id = null;
        try
        {
            var dpiY = GetDeviceCaps(dc, 90); var dpiX = GetDeviceCaps(dc, 88); var width = GetDeviceCaps(dc, 8); var height = GetDeviceCaps(dc, 10);
            IntPtr Font(TicketRow row)
            {
                var key = (row.Points, row.Bold);
                if (!fonts.TryGetValue(key, out var font)) { font = CreateFont(-(int)Math.Ceiling(dpiY * row.Points / 72d), 0, 0, 0, row.Bold ? 700 : 400, 0, 0, 0, 1, 0, 0, 0, 0, "Arial"); if (font == IntPtr.Zero) throw new BridgeFault("spooler_font_failed"); fonts.Add(key, font); }
                var selected = SelectObject(dc, font); if (selected == IntPtr.Zero || selected == new IntPtr(-1)) throw new BridgeFault("spooler_font_failed"); if (previous == IntPtr.Zero) previous = selected;
                return font;
            }
            int MeasureRow(TicketRow row, string text) { Font(row); if (!Measure(dc, text, text.Length, out var size)) throw new BridgeFault("spooler_measure_failed"); return size.Width; }
            int HeightRow(TicketRow row) { Font(row); if (!Measure(dc, "Mg", 2, out var size)) throw new BridgeFault("spooler_measure_failed"); return size.Height; }
            // Measure all text and bounds before the existing durable StartDoc I/O boundary.
            var printable = ThermalLayoutV1.Arrange(ticket, dpiX, dpiY, width, height, MeasureRow, HeightRow);
            if (SetBkMode(dc, 1) == 0 || SetTextColor(dc, 0) == uint.MaxValue || cancellation.IsCancellationRequested || !dispatchAllowed()) return new(false, false);
            var info = new DocInfo { Size = Marshal.SizeOf<DocInfo>(), Name = ticket.DocumentName };
            // From this exact boundary every failure is potentially after I/O, even a failing StartDoc.
            possible = true; var value = StartDoc(dc, ref info); if (value <= 0) return new(false, true); id = value; persistId(value);
            foreach (var page in printable.GroupBy(row => row.Page))
            {
                if (cancellation.IsCancellationRequested || StartPage(dc) <= 0) return new(false, true, id);
                if (SetBkMode(dc, 1) == 0 || SetTextColor(dc, 0) == uint.MaxValue) return new(false, true, id);
                foreach (var row in page) { Font(row.Style); if (cancellation.IsCancellationRequested || !TextOut(dc, row.X, row.Y, row.Text, row.Text.Length)) return new(false, true, id); }
                if (EndPage(dc) <= 0) return new(false, true, id);
            }
            if (EndDoc(dc) <= 0) return new(false, true, id); complete = true; return new(true, true, id);
        }
        catch { return new(false, possible, id); }
        finally { if (possible && !complete) AbortDoc(dc); if (previous != IntPtr.Zero && previous != new IntPtr(-1)) SelectObject(dc, previous); foreach (var font in fonts.Values) DeleteObject(font); DeleteDC(dc); }
    }
}
