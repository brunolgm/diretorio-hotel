using System.Text.Json;
using LibGuest.PrintingBridge.Diagnostics;

namespace LibGuest.PrintingBridge;

// Bounded, allowlisted technical metadata only; never return raw log text.
internal static class MaintenanceDiagnostics
{
    internal sealed record Entry(string Event, string? Error);
    internal static Entry[] Read(string directory)
    {
        var result = new List<Entry>();
        var faults = new List<Entry>();
        foreach (var name in new[] { "bridge.jsonl.2", "bridge.jsonl.1", "bridge.jsonl" })
        {
            var path = Path.Combine(directory, "logs", name);
            if (!File.Exists(path)) continue;
            try
            {
                if (new FileInfo(path).Length > 2 * 1024 * 1024) continue;
                using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
                using var reader = new StreamReader(stream);
                while (reader.ReadLine() is { } line)
                {
                    if (line.Length > 2048) continue;
                    try
                    {
                        using var doc = JsonDocument.Parse(line);
                        var root = doc.RootElement;
                        if (root.ValueKind != JsonValueKind.Object) continue;
                        if (!root.TryGetProperty("event_code", out var code) || code.ValueKind != JsonValueKind.String || !Enum.TryParse<EventCode>(code.GetString(), out var parsed) || !Enum.IsDefined(parsed)) continue;
                        var error = root.TryGetProperty("error_code", out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
                        if (error is not null && !System.Text.RegularExpressions.Regex.IsMatch(error, "^[a-z0-9_]{1,60}$")) error = null;
                        result.Add(new(parsed.ToString(), error));
                        if (error is not null) { faults.Add(new(parsed.ToString(), error)); if (faults.Count > 40) faults.RemoveAt(0); }
                        if (result.Count > 40) result.RemoveAt(0);
                    }
                    catch (JsonException) { }
                }
            }
            catch (IOException) { }
            catch (UnauthorizedAccessException) { }
        }
        return faults.Concat(result).TakeLast(80).ToArray();
    }
}
