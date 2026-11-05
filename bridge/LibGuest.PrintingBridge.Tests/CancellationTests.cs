using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge.Tests;
internal static partial class Program
{
    private static void CancellationTests()
    {
        foreach (var scenario in new[] { "proven", "wrong_job", "stale_revision", "not_received", "authorized", "dispatch_recorded", "ambiguous", "after_intent" })
        {
            var now = DateTimeOffset.UtcNow; var directory = DirectoryName();
            using var journal = new Journal(directory, Guid.NewGuid(), new WindowsProtection());
            var raw = Envelope(); raw["kind"] = "order"; var envelope = Read(raw);
            journal.Receive(envelope, journal.BeginClaim(now), now);
            journal.ReceiptConfirmed(journal.Get(envelope.JobId, 1), Read(Advance(raw, 3, "leased", true, false, false)), now);
            journal.RequestDispatch(journal.Get(envelope.JobId, 1));
            if (scenario == "after_intent") { journal.Authorized(journal.Get(envelope.JobId, 1), Read(Advance(raw, 4, "dispatching", true, true, true)), now); journal.Intent(journal.Get(envelope.JobId, 1), now); }
            var response = Advance(raw, 5, "cancelled", true, false, false);
            if (scenario == "wrong_job") response["job_id"] = Guid.NewGuid();
            if (scenario == "stale_revision") response["revision"] = 3;
            if (scenario == "not_received") response["received"] = false;
            if (scenario == "authorized") response["dispatch_authorized"] = true;
            if (scenario == "dispatch_recorded") response["dispatch_recorded"] = true;
            if (scenario == "ambiguous") response["state"] = "ambiguous";
            var current = journal.Get(envelope.JobId, 1);
            if (scenario == "proven")
            {
                journal.SourceCancelledBeforeDispatch(current, Read(response), now);
                var cancelled = journal.Get(envelope.JobId, 1);
                Check(cancelled.LocalState == "blocked" && cancelled.CloudState == "cancelled" && !cancelled.Intent && cancelled.Result is null, "Proven pre-dispatch cancellation preserves original without invented print result");
                Check(journal.Pending().Count == 0 && journal.Active().Count == 0 && !journal.OperatorRequired, "Proven cancellation atomically frees queue for independent notice");
                Check((long)journal.Database.Query("SELECT count(*) FROM contents")[0][0]! == 0 && (long)journal.Database.Query("SELECT count(*) FROM events WHERE code='source_cancelled_before_dispatch'")[0][0]! == 1, "Proven cancellation deletes private cache and records bounded audit");
                journal.Recover(now); Check(journal.Active().Count == 0 && journal.Pending().Count == 0, "Proven cancellation recovery never recreates dispatch");
            }
            else
            {
                Denied(() => journal.SourceCancelledBeforeDispatch(current, Read(response), now), "Cancellation cannot infer no I/O: " + scenario);
                Check(journal.Get(envelope.JobId, 1) == current, "Rejected cancellation preserves durable state: " + scenario);
            }
        }
    }
}
