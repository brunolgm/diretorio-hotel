using LibGuest.PrintingBridge;
using System.Text.Json;

namespace LibGuest.PrintingBridge.Tests;

internal static partial class Program
{
    private static void MaintenanceTests()
    {
        var directory = DirectoryName();
        var logs = Path.Combine(directory, "logs"); Directory.CreateDirectory(logs);
        File.WriteAllLines(Path.Combine(logs, "bridge.jsonl"), new[] {
            "invalid", "[]", "null",
            "{\"event_code\":\"NotAnEvent\",\"error_code\":\"secret\"}",
            "{\"event_code\":\"NeedsOperator\",\"error_code\":\"cloud_410\",\"credential\":\"NEVER_EXPORT_THIS\"}",
            "{\"event_code\":\"Failure\",\"error_code\":\"unsafe secret! With PII\"}"
        });
        var entries = MaintenanceDiagnostics.Read(directory);
        Check(entries.Any(e => e.Error == "cloud_410") && entries.Any(e => e.Event == "Failure" && e.Error is null), "maintenance diagnostics allowlist error codes and reject malformed records");
        Check(!JsonSerializer.Serialize(entries).Contains("NEVER_EXPORT_THIS"), "maintenance diagnostics never export raw log fields");
        File.WriteAllLines(Path.Combine(logs, "bridge.jsonl"), Enumerable.Repeat("{\"event_code\":\"Heartbeat\"}", 100));
        Check(MaintenanceDiagnostics.Read(directory).Length <= 80, "maintenance diagnostics enforce bounded output");
        var journalPath = Path.Combine(directory, "journal.sqlite");
        Check(!File.Exists(journalPath), "reading maintenance diagnostics does not create or touch a journal");
    }
}
