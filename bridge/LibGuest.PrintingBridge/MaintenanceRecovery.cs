using System.Security.Cryptography;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge;

internal static class MaintenanceRecovery
{
    internal static async Task Resume(Journal journal, CloudClient client, CloudClock clock, CancellationToken token)
    {
        // Never clear a block while an unacknowledged I/O outcome requires reconciliation.
        if (journal.Active().Any(j => j.Intent)) throw new BridgeFault("attempt_reconciliation_required");
        await client.Heartbeat(token); // Credential, TLS and server clock validated before any unblock.
        foreach (var job in journal.Active())
        {
            if (job.Intent || job.ExpiresAt > clock.Now) throw new BridgeFault("pending_job_requires_review");
            journal.Block(job, true); // Existing canonical local no-I/O expiration, preserves tombstones.
        }
        // Canonical device claim expires this hotel's old jobs. Never dispatch the response.
        var key = journal.BeginClaim(clock.Now);
        var received = await client.Claim(key, token);
        if (received is not null)
        {
            try { journal.Receive(received, key, clock.Now); }
            finally { CryptographicOperations.ZeroMemory(received.Content); }
            throw new BridgeFault("pending_job_requires_review");
        }
        journal.CompleteEmptyClaim(key);
        journal.Resume();
    }
}
