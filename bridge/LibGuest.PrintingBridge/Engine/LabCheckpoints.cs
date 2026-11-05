using System.Text.Json;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge;

public sealed class LabCheckpoints(BridgeOptions options)
{
    public static readonly HashSet<string> Stages = ["before_claim", "after_claim", "after_persist", "before_receipt", "after_receipt", "before_dispatch", "after_authorization", "after_intent", "during_simulator", "before_spool", "during_spool", "after_spool", "after_result", "before_ack", "after_ack"];
    public async Task Reach(string stage, Guid? job, long? fence, CancellationToken cancellation)
    {
        if (!options.IsLaboratory || options.LaboratoryCheckpoint != stage) return;
        PrivateFiles.WriteAtomic(Path.Combine(options.ResolvedDataDirectory, "laboratory.checkpoint.json"), JsonSerializer.SerializeToUtf8Bytes(new { stage, job_id = job, fence }));
        // The external LAB supervisor terminates this process, exercising real WAL recovery.
        await Task.Delay(Timeout.InfiniteTimeSpan, cancellation);
    }
}
