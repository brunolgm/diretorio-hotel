using System.Net;
using System.Text.Json;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Diagnostics;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge.Tests;
internal static partial class Program
{
    private static async Task RevisionTests()
    {
        foreach (var result in new[] { "submitted", "ambiguous", "pre_send_failed" })
        {
            var directory = DirectoryName(); var device = Guid.NewGuid(); var protection = new WindowsProtection();
            var options = Options(directory, device); var vault = new CredentialVault(directory, device, protection); vault.Save(Token());
            var envelope = Envelope(); var job = Read(envelope); var now = DateTimeOffset.UtcNow;
            using var journal = new Journal(directory, device, protection); var key = journal.BeginClaim(now); journal.Receive(job, key, now);
            journal.ReceiptConfirmed(journal.Get(job.JobId, 1), Read(Advance(envelope, 3, "leased", true, false, false)), now);
            journal.RequestDispatch(journal.Get(job.JobId, 1));
            journal.Authorized(journal.Get(job.JobId, 1), Read(Advance(envelope, 4, "dispatching", true, true, true, true)), now);
            journal.Intent(journal.Get(job.JobId, 1), now);
            journal.RecordResult(journal.Get(job.JobId, 1), result, result == "submitted" ? "spooler_accepted" : result == "ambiguous" ? "unknown_after_send" : "no_io", result == "pre_send_failed", now);
            var originalKey = journal.Pending("result").Single().Key; var requests = new List<string>(); var resultKeys = new List<Guid>();
            var clock = new CloudClock(); using var client = new CloudClient(options, vault, clock, new Handler(request =>
            {
                var operation = request.RequestUri!.Segments.Last(); requests.Add(operation);
                if (operation == "heartbeat") return Json(new { device_id = device, compatible = true, printer_ready = (bool?)null, server_time = DateTimeOffset.UtcNow });
                if (operation == "receipt") return Json(Advance(envelope, 5, "dispatching", true, true, true));
                if (operation != "result") throw new Exception("unexpected operation");
                using var body = JsonDocument.Parse(request.Content!.ReadAsStringAsync().GetAwaiter().GetResult()); resultKeys.Add(body.RootElement.GetProperty("key").GetGuid());
                return resultKeys.Count == 1 ? new HttpResponseMessage(HttpStatusCode.Conflict) : Json(Advance(envelope, 6, result == "pre_send_failed" ? "retry_wait" : result, true, false, true));
            }));
            using var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(10));
            await new BridgeWorker(options, journal, client, clock, new BoundedLog(Path.Combine(directory, "logs"))).Run(true, cancel.Token);
            Check(journal.Get(job.JobId, 1).LocalState == "terminal" && journal.Pending().Count == 0, "C5 newer owned revision reconciles durable " + result);
            Check(resultKeys.Count == 2 && resultKeys.All(k => k == originalKey), "C5 revision reconciliation keeps same ACK key " + result);
            Check(requests.All(r => r is "result" or "receipt" or "heartbeat") && (long)journal.Database.Query("SELECT count(*) FROM spooler_calls")[0][0]! == 0 && (long)journal.Database.Query("SELECT count(*) FROM simulator_calls")[0][0]! == 0, "C5 revision reconciliation performs no adapter/claim " + result);
        }
    }
}
