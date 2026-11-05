using System.Security.Cryptography;
using System.Text.Json;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge.Printing;

public sealed class WindowsSpoolerAdapter(BridgeOptions options, Journal journal, CloudClock clock, IWindowsSpooler spooler, CloudClient? client = null) : IPrintAdapter
{
    public async Task<AdapterResult> Execute(JournalJob job, CancellationToken cancellation)
    {
        if (!options.WindowsSpoolerEnabled || !job.Intent) throw new BridgeFault("dispatch_intent_required");
        var bytes = journal.AuthorizationContent(job, clock.Now);
        try
        {
            using var document = JsonDocument.Parse(bytes); var root = document.RootElement; var destination = SpoolerDestination.Read(root, options.DeviceId, job);
            journal.EnterSpooler(job, destination.PrinterId, destination.Revision, destination.Queue, clock.Now);
            TicketV1 ticket; try { ticket = TicketRendererV1.Render(root, destination, clock.Now); } catch { return new("pre_send_failed", "no_io", true); }
            var observation = spooler.Observe(destination.Queue); journal.SpoolObservation(job, observation.State);
            if (client is not null) await client.ObserveSpooler(job, destination.PrinterId, destination.Revision, observation.State is "unknown" or "paper_out" or "offline" ? observation.State : !observation.SpoolerAvailable ? "offline" : "error", cancellation);
            if (!observation.CanSubmit) return new("pre_send_failed", "connection_unavailable", true);
            var checkpoints = new LabCheckpoints(options); await checkpoints.Reach("before_spool", job.JobId, job.Fence, cancellation);
            if (!clock.Permits(job.LeaseUntil, job.ExpiresAt)) return new("pre_send_failed", "no_io", true);
            SpoolSubmission result;
            var privateExpiry = root.TryGetProperty("private", out var data) && data.TryGetProperty("expires_at", out var expiry) ? expiry.GetDateTimeOffset() : (DateTimeOffset?)null;
            bool Allowed() => clock.Permits(job.LeaseUntil, job.ExpiresAt) && (privateExpiry is null || clock.Now < privateExpiry);
            try { result = await spooler.Submit(destination.Queue, ticket, id => journal.SpoolId(job, id), Allowed, cancellation); }
            catch { result = new(false, true); }
            if (result.Accepted)
            {
                journal.SpoolObservation(job, "submitted", clock.RetentionNow); await checkpoints.Reach("after_spool", job.JobId, job.Fence, cancellation); return new("submitted", "spooler_accepted", false);
            }
            return result.PossibleIo ? new("ambiguous", "unknown_after_send", false) : new("pre_send_failed", "connection_unavailable", true);
        }
        finally { CryptographicOperations.ZeroMemory(bytes); }
    }
}
/// <summary>Explicit LAB transport. It submits nothing to Windows and creates no spool/PDF files.</summary>
public sealed class LaboratorySpooler(BridgeOptions options, Journal journal, JournalJob job) : IWindowsSpooler
{
    public QueueObservation Observe(string queue)
    {
        if (!options.IsLaboratory || !options.LaboratorySpooler) throw new BridgeFault("laboratory_required");
        return options.LaboratorySpoolerScenario switch { "offline" => new(false, false, "unavailable"), "missing_queue" => new(true, false, "missing_queue"), "paper_out" => new(true, true, "paper_out"), _ => new(true, true, "unknown") };
    }
    public async Task<SpoolSubmission> Submit(string queue, TicketV1 ticket, Action<int> persistId, Func<bool> dispatchAllowed, CancellationToken cancellation)
    {
        if (!options.IsLaboratory || !options.LaboratorySpooler) throw new BridgeFault("laboratory_required");
        if (!dispatchAllowed()) return new(false, false);
        persistId(100000 + (int)(BitConverter.ToUInt32(job.JobId.ToByteArray()) % 1000000000));
        journal.SpoolObservation(job, "lab_io_entered"); await new LabCheckpoints(options).Reach("during_spool", job.JobId, job.Fence, cancellation);
        if (options.LaboratorySpoolerScenario == "delay") await Task.Delay(options.SimulatorDelayMilliseconds, cancellation);
        return options.LaboratorySpoolerScenario is "ambiguous" or "no_response" ? new(false, true) : new(true, true);
    }
}
