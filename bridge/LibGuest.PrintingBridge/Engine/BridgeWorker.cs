using System.Diagnostics;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Diagnostics;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge;

public sealed class BridgeWorker(BridgeOptions options, Journal journal, CloudClient client, CloudClock clock, BoundedLog log)
{
    private readonly LabCheckpoints checkpoints = new(options);
    private long lastHeartbeat;
    private long lastClaim;
    public async Task Run(bool once, CancellationToken cancellation)
    {
        if (once && !options.IsLaboratory) throw new BridgeFault("laboratory_required");
        journal.Recover(clock.RetentionNow); var failures = 0; var initialTerminals = (long)journal.Database.Query("SELECT count(*) FROM jobs WHERE local_state='terminal'")[0][0]!;
        if (journal.OperatorRequired) throw new BridgeFault("operator_required");
        try
        {
            while (!cancellation.IsCancellationRequested)
            {
                try
                {
                    Purge();
                    if (await DrainAcknowledgements(cancellation)) { failures = 0; continue; }
                    if (!clock.IsFresh || lastHeartbeat == 0 || Stopwatch.GetElapsedTime(lastHeartbeat).TotalSeconds >= options.HeartbeatSeconds)
                    {
                        await client.Heartbeat(cancellation); lastHeartbeat = Stopwatch.GetTimestamp(); Purge(); log.Write(EventCode.Heartbeat);
                    }
                    if (!options.SimulatorEnabled)
                    {
                        log.Write(EventCode.AdapterUnavailable); await Delay(TimeSpan.FromSeconds(options.IdlePollSeconds), cancellation); continue;
                    }
                    if (await DrainDispatch(cancellation)) { failures = 0; continue; }
                    var job = journal.Active().FirstOrDefault();
                    if (job is not null)
                    {
                        await Process(job, cancellation); failures = 0; continue;
                    }
                    if (once && (long)journal.Database.Query("SELECT count(*) FROM jobs WHERE local_state='terminal'")[0][0]! > initialTerminals) return;
                    var spacing = lastClaim == 0 ? TimeSpan.Zero : TimeSpan.FromSeconds(options.ActivePollSeconds) - Stopwatch.GetElapsedTime(lastClaim);
                    if (spacing < TimeSpan.Zero) spacing = TimeSpan.Zero;
                    await Delay(spacing + Jitter(), cancellation);
                    await checkpoints.Reach("before_claim", null, null, cancellation);
                    var key = journal.BeginClaim(clock.Now);
                    lastClaim = Stopwatch.GetTimestamp();
                    JobEnvelope? received;
                    try { received = await client.Claim(key, cancellation); }
                    catch (BridgeFault e) when (e.Code is "cloud_409" or "cloud_410") { journal.CompleteEmptyClaim(key); await Delay(TimeSpan.FromSeconds(options.ActivePollSeconds), cancellation); continue; }
                    if (received is null) { journal.CompleteEmptyClaim(key); if (once && initialTerminals > 0) return; await Delay(TimeSpan.FromSeconds(options.IdlePollSeconds) + Jitter(), cancellation); continue; }
                    await checkpoints.Reach("after_claim", received.JobId, received.Fence, cancellation);
                    if (received.State != "leased" || received.Received || received.DispatchRecorded || !clock.Permits(received.LeaseUntil, received.ExpiresAt)) throw new BridgeFault("claim_state_incompatible");
                    try { journal.Receive(received, key, clock.Now); } finally { System.Security.Cryptography.CryptographicOperations.ZeroMemory(received.Content); }
                    log.Write(EventCode.JobReceived, received.JobId, received.AttemptId, received.Fence);
                    await checkpoints.Reach("after_persist", received.JobId, received.Fence, cancellation); failures = 0;
                }
                catch (BridgeFault e) when (e.Code is "cloud_offline" or "cloud_timeout" or "cloud_408" or "cloud_429" or "cloud_500" or "cloud_502" or "cloud_503" or "cloud_504")
                {
                    failures = Math.Min(failures + 1, 10); log.Write(EventCode.NetworkBackoff, error: e.Code);
                    await Delay(TimeSpan.FromSeconds(Math.Min(options.MaximumBackoffSeconds, Math.Pow(2, failures))) + Jitter(), cancellation);
                }
                catch (BridgeFault e)
                {
                    journal.NeedsOperator(); log.Write(EventCode.NeedsOperator, error: e.Code); throw;
                }
            }
        }
        finally { journal.ClearPrivate(); }
    }
    private static TimeSpan Jitter() => TimeSpan.FromMilliseconds(Random.Shared.Next(0, 750));
    private void Purge() { if (clock.HasAnchor) journal.Purge(clock.RetentionNow); }
    private async Task Delay(TimeSpan duration, CancellationToken cancellation)
    {
        var start = Stopwatch.GetTimestamp();
        while (Stopwatch.GetElapsedTime(start) < duration) { Purge(); await Task.Delay(TimeSpan.FromMilliseconds(Math.Min(1000, Math.Max(1, (duration - Stopwatch.GetElapsedTime(start)).TotalMilliseconds))), cancellation); }
    }
    private async Task<bool> DrainAcknowledgements(CancellationToken cancellation)
    {
        var operation = journal.Pending().FirstOrDefault(p => p.Operation is "result" or "receipt"); if (operation is null) return false;
        var job = journal.Get(operation.JobId!.Value, operation.Fence);
        try
        {
            if (operation.Operation == "result")
            {
                await checkpoints.Reach("before_ack", job.JobId, job.Fence, cancellation);
                var response = await client.Result(job, operation, cancellation); journal.ResultAcknowledged(job, response, operation.Result!, clock.RetentionNow);
                log.Write(EventCode.ResultAcknowledged, job.JobId, job.AttemptId, job.Fence); await checkpoints.Reach("after_ack", job.JobId, job.Fence, cancellation);
            }
            else
            {
                await checkpoints.Reach("before_receipt", job.JobId, job.Fence, cancellation);
                var response = await client.Receipt(job, cancellation); journal.ReceiptConfirmed(job, response, clock.RetentionNow);
                log.Write(EventCode.ReceiptCommitted, job.JobId, job.AttemptId, job.Fence); await checkpoints.Reach("after_receipt", job.JobId, job.Fence, cancellation);
            }
        }
        catch (BridgeFault e) when (e.Code == "cloud_409") { await Reconcile(job, operation, cancellation); }
        catch (BridgeFault e) when (e.Code == "cloud_410" && !job.Intent) { journal.Block(job, true); }
        return true;
    }
    private async Task Reconcile(JournalJob job, PendingOperation operation, CancellationToken cancellation)
    {
        JobEnvelope response;
        try { response = await client.Receipt(job, cancellation); }
        catch (BridgeFault e) when (e.Code is "cloud_409" or "cloud_410") { log.Write(EventCode.ProtocolBlocked, job.JobId, job.AttemptId, job.Fence, e.Code); if (job.Intent) throw new BridgeFault("attempt_reconciliation_required"); journal.Block(job, false); return; }
        Journal.Match(job, response);
        if (operation.Operation == "result")
        {
            if (response.State == (operation.Result == "pre_send_failed" ? "retry_wait" : operation.Result)) journal.ResultAcknowledged(job, response, operation.Result!, clock.RetentionNow);
            else if (operation.Result == "submitted" && response.State == "ambiguous") journal.Revise(job, response);
            else throw new BridgeFault("attempt_reconciliation_required");
        }
        else if (!job.Intent && response.State == "leased" && response.Received) journal.ReceiptConfirmed(job, response, clock.RetentionNow);
        else throw new BridgeFault("attempt_reconciliation_required");
    }
    private async Task<bool> DrainDispatch(CancellationToken cancellation)
    {
        var operation = journal.Pending("dispatch").FirstOrDefault(); if (operation is null) return false;
        var job = journal.Get(operation.JobId!.Value, operation.Fence);
        if (!clock.Permits(job.LeaseUntil, job.ExpiresAt))
        {
            if (job.CloudState == "dispatching") throw new BridgeFault("authorization_uncertain"); journal.Block(job, true); return true;
        }
        await checkpoints.Reach("before_dispatch", job.JobId, job.Fence, cancellation);
        try
        {
            var response = await client.Dispatch(job, cancellation);
            try
            {
                if (!clock.Permits(response.LeaseUntil, response.ExpiresAt)) throw new BridgeFault("authorization_expired");
                journal.Authorized(job, response, clock.Now);
            }
            finally { System.Security.Cryptography.CryptographicOperations.ZeroMemory(response.Content); }
            log.Write(EventCode.AuthorizationCommitted, job.JobId, job.AttemptId, job.Fence);
            await checkpoints.Reach("after_authorization", job.JobId, job.Fence, cancellation);
        }
        catch (BridgeFault e) when (e.Code is "cloud_409" or "cloud_410")
        {
            // A dispatch request may already have committed. Never infer no-I/O from its missing response.
            throw new BridgeFault("authorization_reconciliation_required");
        }
        return true;
    }
    private async Task Process(JournalJob job, CancellationToken cancellation)
    {
        if (job.LocalState == "receipted")
        {
            if (!clock.Permits(job.LeaseUntil, job.ExpiresAt)) { journal.Block(job, true); return; }
            journal.RequestDispatch(job); return;
        }
        if (job.LocalState != "authorized" || job.Intent) throw new BridgeFault("local_state_invalid");
        if (!clock.Permits(job.LeaseUntil, job.ExpiresAt)) throw new BridgeFault("authorization_expired");
        journal.Intent(job, clock.Now); log.Write(EventCode.DispatchIntent, job.JobId, job.AttemptId, job.Fence);
        await checkpoints.Reach("after_intent", job.JobId, job.Fence, cancellation);
        var current = journal.Get(job.JobId, job.Fence); journal.EnterSimulator(current, options.SimulatorScenario, clock.Now);
        AdapterResult result;
        try { result = await new LaboratorySimulator(options).Execute(current, cancellation); }
        catch (OperationCanceledException) { result = new("ambiguous", "unknown_after_send", false); }
        journal.RecordResult(current, result.Result, result.Code, result.NoIo, clock.RetentionNow); log.Write(EventCode.ResultCommitted, job.JobId, job.AttemptId, job.Fence);
        await checkpoints.Reach("after_result", job.JobId, job.Fence, cancellation);
    }
}
