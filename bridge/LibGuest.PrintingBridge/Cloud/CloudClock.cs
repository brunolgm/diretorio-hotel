using System.Diagnostics;

namespace LibGuest.PrintingBridge.Cloud;

/// <summary>Lease decisions use a fresh server anchor plus monotonic elapsed time, not the workstation wall clock.</summary>
public sealed class CloudClock
{
    private DateTimeOffset server;
    private long timestamp;
    public bool HasAnchor => timestamp != 0;
    public bool IsFresh => timestamp != 0 && Stopwatch.GetElapsedTime(timestamp) < TimeSpan.FromSeconds(90);
    public DateTimeOffset Now => IsFresh ? server + Stopwatch.GetElapsedTime(timestamp) : throw new BridgeFault("cloud_clock_required");
    public DateTimeOffset RetentionNow => timestamp != 0 ? server + Stopwatch.GetElapsedTime(timestamp) : DateTimeOffset.UtcNow;
    public void Synchronize(DateTimeOffset value) { server = value; timestamp = Stopwatch.GetTimestamp(); }
    public bool Permits(DateTimeOffset lease, DateTimeOffset expires) => IsFresh && Now + TimeSpan.FromSeconds(2) < lease && Now + TimeSpan.FromSeconds(2) < expires;
}
