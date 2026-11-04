using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge;

public sealed record AdapterResult(string Result, string Code, bool NoIo);
public interface IPrintAdapter
{
    Task<AdapterResult> Execute(JournalJob job, CancellationToken cancellation);
}

/// <summary>C2 has exactly one adapter: an explicitly LAB-only deterministic simulator. It opens no printer/device/socket.</summary>
public sealed class LaboratorySimulator : IPrintAdapter
{
    private readonly BridgeOptions options;
    public LaboratorySimulator(BridgeOptions options)
    {
        if (!options.IsLaboratory || !options.SimulatorEnabled) throw new BridgeFault("laboratory_required"); this.options = options;
    }
    public async Task<AdapterResult> Execute(JournalJob job, CancellationToken cancellation)
    {
        if (!job.Intent) throw new BridgeFault("dispatch_intent_required");
        await new LabCheckpoints(options).Reach("during_simulator", job.JobId, job.Fence, cancellation);
        await Task.Delay(options.SimulatorDelayMilliseconds, cancellation);
        return options.SimulatorScenario switch
        {
            "success" or "delay" => new("submitted", "transport_accepted", false),
            "safe_failure" => new("pre_send_failed", "no_io", true),
            "ambiguous" or "no_response" => new("ambiguous", "unknown_after_send", false),
            _ => throw new BridgeFault("simulator_invalid")
        };
    }
}
