using System.Net;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Diagnostics;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge.Tests;

internal static partial class Program
{
    private static async Task AuthorizationRecoveryTests()
    {
        var directory = DirectoryName(); var device = Guid.NewGuid(); var protection = new WindowsProtection();
        var options = Options(directory, device); var vault = new CredentialVault(directory, device, protection); vault.Save(Token());
        using var journal = new Journal(directory, device, protection);
        var raw = Envelope(); var incoming = Read(raw); var now = DateTimeOffset.UtcNow;
        journal.Receive(incoming, journal.BeginClaim(now), now);
        journal.ReceiptConfirmed(journal.Get(incoming.JobId, 1), Read(Advance(raw, 3, "leased", true, false, false)), now);
        journal.RequestDispatch(journal.Get(incoming.JobId, 1));
        var operations = new List<string>(); var clock = new CloudClock(); var serverNow = now;
        var normalWorker = false; var claimed = false; var fresh = Envelope();
        using var client = new CloudClient(options, vault, clock, new Handler(request => {
            var op = request.RequestUri!.AbsolutePath.Split('/').Last(); operations.Add(op);
            return op switch {
                "heartbeat" => Json(new { device_id = device, server_time = serverNow, compatible = true, printer_ready = (bool?)null }),
                "dispatch" => normalWorker ? Json(Advance(fresh, 4, "dispatching", true, true, true, true)) : new HttpResponseMessage(HttpStatusCode.Conflict),
                "receipt" => Json(Advance(normalWorker ? fresh : raw, 3, "leased", true, false, false)),
                "claim" when normalWorker && !claimed => ClaimFresh(),
                "claim" => Json(new { job_id = (string?)null }),
                "result" when normalWorker => Json(Advance(fresh, 5, "submitted", true, false, true)),
                _ => throw new Exception("unexpected authorization recovery operation")
            };
        }));
        HttpResponseMessage ClaimFresh() { claimed = true; return Json(fresh); }
        try { await new BridgeWorker(options, journal, client, clock, new BoundedLog(Path.Combine(directory, "logs"))).Run(true, CancellationToken.None); throw new Exception("must block"); }
        catch (BridgeFault fault) { Check(fault.Code == "authorization_reconciliation_required", "dispatch conflict without cancellation proof raises authorization_reconciliation_required"); }
        Check(journal.OperatorRequired && !journal.Get(incoming.JobId, 1).Intent, "authorization reconciliation failure durably requires operator without fabricating intent");
        operations.Clear();
        await DeniedAsync(() => new BridgeWorker(options, journal, client, clock, new BoundedLog(Path.Combine(directory, "logs"))).Run(true, CancellationToken.None), "normal worker fails closed while operator required");
        Check(operations.Count == 0, "blocked restart neither claims nor submits");
        serverNow = incoming.ExpiresAt.AddMinutes(1);
        await MaintenanceRecovery.Resume(journal, client, clock, CancellationToken.None);
        Check(!journal.OperatorRequired && journal.Get(incoming.JobId, 1).LocalState == "expired" && journal.Pending().Count == 0, "canonical recovery preserves expired authorization history and clears operator block");
        Check(operations.SequenceEqual(new[] { "heartbeat", "claim" }), "authorization recovery only heartbeats and expires through canonical claim");
        Check((long)journal.Database.Query("SELECT count(*) FROM spooler_calls")[0][0]! == 0, "authorization recovery performs zero spool submissions");
        normalWorker = true;
        fresh["lease_until"] = serverNow.AddMinutes(1); fresh["expires_at"] = serverNow.AddMinutes(15);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        await new BridgeWorker(options, journal, client, clock, new BoundedLog(Path.Combine(directory, "logs"))).Run(true, timeout.Token);
        Check(journal.Get(Read(fresh).JobId, 1).LocalState == "terminal" && journal.Get(incoming.JobId, 1).LocalState == "expired", "normal worker handles fresh work after recovery without reviving expired work");
        Check((long)journal.Database.Query("SELECT count(*) FROM simulator_calls")[0][0]! == 1, "worker return submits only the new LAB job once");
    }
}
