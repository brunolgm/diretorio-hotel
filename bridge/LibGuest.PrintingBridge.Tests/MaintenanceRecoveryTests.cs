using System.Net;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge.Tests;

internal static partial class Program
{
    private static async Task MaintenanceRecoveryTests()
    {
        var directory = DirectoryName(); var device = Guid.NewGuid(); var protection = new WindowsProtection();
        var options = Options(directory, device); var vault = new CredentialVault(directory, device, protection); vault.Save(Token());
        using var journal = new Journal(directory, device, protection);
        journal.NeedsOperator();
        var clock = new CloudClock();
        using (var failed = new CloudClient(options, vault, clock, new Handler(_ => new HttpResponseMessage(HttpStatusCode.Forbidden))))
        {
            await DeniedAsync(() => MaintenanceRecovery.Resume(journal, failed, clock, CancellationToken.None), "maintenance resume refuses an invalid heartbeat");
            Check(journal.OperatorRequired, "failed heartbeat preserves operator-required and journal");
        }
        var raw = Envelope(); var expired = DateTimeOffset.UtcNow.AddHours(-1);
        raw["lease_until"] = expired; raw["expires_at"] = expired;
        var envelope = Read(raw);
        journal.Receive(envelope, journal.BeginClaim(expired.AddMinutes(-15)), expired.AddMinutes(-15));
        var job = journal.Get(envelope.JobId, 1);
        journal.ReceiptConfirmed(job, Read(Advance(raw, 3, "leased", true, false, false)), expired.AddMinutes(-14));
        job = journal.Get(envelope.JobId, 1); journal.RequestDispatch(job);
        var operations = new List<string>();
        using var client = new CloudClient(options, vault, clock, new Handler(request => {
            var op = request.RequestUri!.AbsolutePath.Split('/').Last(); operations.Add(op);
            return op switch {
                "heartbeat" => Json(new { device_id = device, server_time = DateTimeOffset.UtcNow, compatible = true, printer_ready = (bool?)null }),
                "claim" => Json(new { job_id = (string?)null }),
                _ => throw new Exception("maintenance attempted print operation")
            };
        }));
        await MaintenanceRecovery.Resume(journal, client, clock, CancellationToken.None);
        Check(!journal.OperatorRequired && journal.Pending().Count == 0 && journal.Get(envelope.JobId, 1).LocalState == "expired", "maintenance expires only proven no-I/O pending local work and clears block");
        Check(operations.SequenceEqual(new[] { "heartbeat", "claim" }), "maintenance resume validates heartbeat then canonical expiry without receipt dispatch or result");
        Check(journal.Database.Query("SELECT count(*) FROM spooler_calls")[0][0] is long count && count == 0, "maintenance resume never invokes Windows Spooler");
        var active = Envelope();
        var incoming = Read(active); journal.Receive(incoming, journal.BeginClaim(DateTimeOffset.UtcNow), DateTimeOffset.UtcNow);
        job = journal.Get(incoming.JobId, 1);
        journal.ReceiptConfirmed(job, Read(Advance(active, 3, "leased", true, false, false)), DateTimeOffset.UtcNow);
        job = journal.Get(incoming.JobId, 1); journal.RequestDispatch(job);
        journal.Authorized(job, Read(Advance(active, 4, "dispatching", true, true, true, true)), DateTimeOffset.UtcNow);
        job = journal.Get(incoming.JobId, 1); journal.Intent(job, DateTimeOffset.UtcNow); journal.NeedsOperator();
        operations.Clear();
        await DeniedAsync(() => MaintenanceRecovery.Resume(journal, client, clock, CancellationToken.None), "maintenance refuses an unresolved dispatch intent");
        Check(journal.OperatorRequired && journal.Get(incoming.JobId, 1).Intent && operations.Count == 0, "ambiguous attempt stays blocked without network or replay");
    }
}
