using System.Text.Json;

namespace LibGuest.PrintingBridge.Diagnostics;

public enum EventCode { Starting, Stopped, Paired, CredentialUpdated, NeedsOperator, InstanceBusy, Heartbeat, JobReceived, ReceiptCommitted, AuthorizationCommitted, DispatchIntent, SimulatorCompleted, ResultCommitted, ResultAcknowledged, RecoveryAmbiguous, NetworkBackoff, ProtocolBlocked, JournalBlocked, Retention, Failure, AdapterUnavailable }

public sealed class BoundedLog
{
    private readonly string path;
    private readonly long maximumBytes;
    private readonly object gate = new();
    public BoundedLog(string directory, long maximumBytes = 1024 * 1024) { Directory.CreateDirectory(directory); path = Path.Combine(directory, "bridge.jsonl"); this.maximumBytes = maximumBytes; }
    public void Write(EventCode code, Guid? job = null, Guid? attempt = null, long? fence = null, string? error = null)
    {
        var safeError = error is not null && System.Text.RegularExpressions.Regex.IsMatch(error, "^[a-z0-9_]{1,60}$") ? error : null;
        var line = JsonSerializer.Serialize(new { at = DateTimeOffset.UtcNow, event_code = code.ToString(), job_id = job, attempt_id = attempt, fence, error_code = safeError });
        lock (gate)
        {
            try
            {
                if (File.Exists(path) && new FileInfo(path).Length + line.Length * 4 > maximumBytes)
                {
                    if (File.Exists(path + ".2")) File.Delete(path + ".2");
                    if (File.Exists(path + ".1")) File.Move(path + ".1", path + ".2");
                    File.Move(path, path + ".1");
                }
                File.AppendAllText(path, line + System.Environment.NewLine);
            }
            catch { Console.Error.WriteLine("{\"event_code\":\"log_unavailable\"}"); }
        }
    }
}
