using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Printing;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge.Tests;
internal static partial class Program
{
    private sealed class FakeWindowsSpooler(QueueObservation observation, SpoolSubmission result, bool throws = false) : IWindowsSpooler
    {
        public int Calls; public TicketV1? Ticket;
        public QueueObservation Observe(string queue) => observation;
        public Task<SpoolSubmission> Submit(string queue, TicketV1 ticket, Action<int> persistId, Func<bool> dispatchAllowed, CancellationToken cancellation)
        {
            if (!dispatchAllowed()) return Task.FromResult(new SpoolSubmission(false, false)); Calls++; Ticket = ticket; if (result.JobId is int id) persistId(id); if (throws) throw new IOException(); return Task.FromResult(result);
        }
    }
    private static Dictionary<string, object?> SpoolEnvelope(Guid device)
    {
        var raw = Envelope(); var destination = Guid.NewGuid(); var printer = Guid.NewGuid();
        raw["destination_id"] = destination;
        raw["routing"] = new { destination_revision = 1, allow_room = true, allow_notes = true, allow_name = false, printer = new { id = printer, revision = 1, device_id = device, destination_id = destination, adapter = "windows_spooler", active = true, config = new { queue_name = "LAB_UNIT_NEVER_SUBMITTED" } } };
        raw["spooler"] = new { version = 1, device_id = device, destination_id = destination, destination_revision = 1, printer_id = printer, printer_revision = 1, queue_name = "LAB_UNIT_NEVER_SUBMITTED", hotel_name = "Hotel sintético" };
        return raw;
    }
    private static JournalJob Authorize(Journal journal, Dictionary<string, object?> raw, DateTimeOffset now)
    {
        var envelope = Read(raw); journal.Receive(envelope, journal.BeginClaim(now), now); var job = journal.Get(envelope.JobId, 1); journal.ReceiptConfirmed(job, Read(Advance(raw, 3, "leased", true, false, false)), now); job = journal.Get(envelope.JobId, 1); journal.RequestDispatch(job); journal.Authorized(job, Read(Advance(raw, 4, "dispatching", true, true, true, true)), now); job = journal.Get(envelope.JobId, 1); journal.Intent(job, now); return journal.Get(job.JobId, 1);
    }
    private static async Task SpoolerTests()
    {
        var device = Guid.NewGuid(); var source = SpoolEnvelope(device); var authorized = Advance(source, 4, "dispatching", true, true, true, true); var envelope = Read(authorized); var job = new JournalJob(envelope.JobId, envelope.AttemptId, 1, 4, envelope.Hash, "test", "dispatching", envelope.LeaseUntil, envelope.ExpiresAt, "intent", true, null);
        var context = SpoolerDestination.Read(JsonSerializer.SerializeToElement(authorized), device, job); Check(context.Queue == "LAB_UNIT_NEVER_SUBMITTED", "C4 uses queue from authorized configuration only");
        Denied(() => SpoolerDestination.Read(JsonSerializer.SerializeToElement(authorized), Guid.NewGuid(), job), "C4 destination cannot move to another bridge");
        foreach (var bad in new[] { "", "../queue", "\\\\server\\share", "queue\ncommand", " leading", "<script>" }) Check(!SpoolerDestination.ValidQueue(bad), "C4 rejects untrusted queue path/control syntax");
        var ticket = TicketRendererV1.Render(JsonSerializer.SerializeToElement(authorized), context, DateTimeOffset.UtcNow); Check(ticket.Lines.Contains("TESTE LIBGUEST — NÃO É PEDIDO") && ticket.DocumentName == "LibGuest TESTE", "C4 test is unmistakably synthetic with safe spool document title");
        var parent = Guid.NewGuid(); var leaf = Guid.NewGuid(); var snapshot = new { payload_version = 1, renderer_version = 1, reference = "A1B2C3D4", created_at = DateTimeOffset.UtcNow, sector_name = "Cozinha", fulfilment = "room_delivery", lines = new[] { new { line_id = leaf, parent_id = parent, name = "Prato de fixture", quantity = 2, combo_context = "Combo de fixture", options = new[] { new { name = "Opção", group_name = "Grupo", quantity = 4 } } } } };
        var canonical = JsonSerializer.Serialize(snapshot); var order = new Dictionary<string, object?>(authorized) { ["kind"] = "reprint", ["snapshot"] = snapshot, ["snapshot_canonical"] = canonical, ["snapshot_hash"] = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))), ["private"] = new { expired = false, expires_at = DateTimeOffset.UtcNow.AddMinutes(1), name_enabled = true, first_name = "C4_PRIVATE_NAME", room_label = "C4_PRIVATE_ROOM", note = "C4_PRIVATE_NOTE", email = "NEVER_RENDER_EMAIL", phone = "NEVER_RENDER_PHONE", roomToken = "NEVER_RENDER_TOKEN", line_notes = new[] { new { line_id = parent, note = "C4_COMBO_NOTE" } } } };
        var rendered = TicketRendererV1.Render(JsonSerializer.SerializeToElement(order), context, DateTimeOffset.UtcNow); var text = string.Join('\n', rendered.Lines);
        Check(text.Contains("REIMPRESSÃO", StringComparison.Ordinal) && text.Contains("2 × Prato", StringComparison.Ordinal) && text.Contains("×4", StringComparison.Ordinal) && !text.Contains("×8", StringComparison.Ordinal), "C4 preserves frozen combo component/option quantities without multiplication");
        Check(text.Contains("Combo de fixture", StringComparison.Ordinal) && text.Contains("C4_COMBO_NOTE", StringComparison.Ordinal), "C4 keeps sector combo context and permitted parent note");
        Check(text.Contains("C4_PRIVATE_ROOM", StringComparison.Ordinal) && !text.Contains("C4_PRIVATE_NAME", StringComparison.Ordinal) && !text.Contains("NEVER_RENDER", StringComparison.Ordinal), "C4 room only when authorized; name defaults OFF and extra private fields excluded");
        var expired = TicketRendererV1.Render(JsonSerializer.SerializeToElement(order), context, DateTimeOffset.UtcNow.AddHours(1)); Check(!string.Join('\n', expired.Lines).Contains("C4_PRIVATE", StringComparison.Ordinal) && !string.Join('\n', expired.Lines).Contains("C4_COMBO_NOTE", StringComparison.Ordinal), "C4 expired PII cannot reappear or be reconstructed from commercial data");
        Check(!TicketRendererV1.Clean("a\u001bb\u202ec\n d").Any(char.IsControl), "C4 renderer removes device controls and bidi injection");
        var cancellationSnapshot = JsonSerializer.SerializeToElement(snapshot).Deserialize<Dictionary<string, JsonElement>>()!;
        cancellationSnapshot["document_kind"] = JsonSerializer.SerializeToElement("cancellation");
        cancellationSnapshot["cancelled_at"] = JsonSerializer.SerializeToElement(DateTimeOffset.UtcNow);
        cancellationSnapshot["cancellation_reason_code"] = JsonSerializer.SerializeToElement("guest_request");
        var cancellationCanonical = JsonSerializer.Serialize(cancellationSnapshot);
        foreach (var cancellationKind in new[] { "cancellation", "reprint" })
        {
            var cancellation = new Dictionary<string, object?>(order) { ["kind"] = cancellationKind, ["snapshot"] = cancellationSnapshot, ["snapshot_canonical"] = cancellationCanonical, ["snapshot_hash"] = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(cancellationCanonical))) };
            Check(Read(cancellation).Kind == cancellationKind, "Cancellation and explicit reprint parse additive V1 kind");
            var notice = TicketRendererV1.Render(JsonSerializer.SerializeToElement(cancellation), context, DateTimeOffset.UtcNow);
            Check(notice.Lines.Contains("CANCELAMENTO") && notice.Lines.Any(l => l.StartsWith("Cancelado em:", StringComparison.Ordinal)), "Cancellation notice has explicit label and timestamp");
            Check(notice.Lines.Any(l => l.Contains("A1B2C3D4", StringComparison.Ordinal)) && notice.Lines.Any(l => l.Contains("Cozinha", StringComparison.Ordinal)) && notice.Lines.Any(l => l.Contains("Prato de fixture", StringComparison.Ordinal)), "Cancellation preserves original reference, sector and frozen items");
            var redactedNotice = TicketRendererV1.Render(JsonSerializer.SerializeToElement(cancellation), context, DateTimeOffset.UtcNow.AddHours(1));
            Check(!string.Join('\n', redactedNotice.Lines).Contains("C4_PRIVATE", StringComparison.Ordinal), "Cancellation never revives expired PII");
        }
        Denied(() => TicketRendererV1.Clean(new string('x', 2001)), "C4 oversized text fails before physical submission");
        foreach (var scenario in new[] { "accepted", "offline", "missing", "paper", "uncertain", "pre_io", "exception", "retained" })
        {
            var dir = DirectoryName(); var options = new BridgeOptions { DeviceId = device, CloudBaseUrl = "https://localhost/", DataDirectory = dir, Environment = "laboratory", WindowsSpoolerEnabled = true, LaboratorySpooler = true }; var clock = new CloudClock(); clock.Synchronize(DateTimeOffset.UtcNow);
            using var journal = new Journal(dir, device, new WindowsProtection()); var current = Authorize(journal, SpoolEnvelope(device), clock.Now);
            var observation = scenario switch { "offline" => new QueueObservation(false, false, "unavailable"), "missing" => new(true, false, "missing_queue"), "paper" => new(true, true, "paper_out"), "retained" => new(true, true, "unknown", 0, true), _ => new(true, true, "unknown") };
            var transport = new FakeWindowsSpooler(observation, scenario == "accepted" ? new(true, true, 123) : scenario == "pre_io" ? new(false, false) : new(false, true, 456), scenario == "exception"); var adapter = new WindowsSpoolerAdapter(options, journal, clock, transport); var result = await adapter.Execute(current, CancellationToken.None);
            Check(result.Result == (scenario == "accepted" ? "submitted" : scenario is "offline" or "missing" or "paper" or "pre_io" or "retained" ? "pre_send_failed" : "ambiguous"), "C4 classifies actual I/O boundary " + scenario);
            Check(transport.Calls == (scenario is "offline" or "missing" or "paper" or "retained" ? 0 : 1), "C4 no spool call before eligible queue " + scenario);
            if (scenario == "accepted") Check((long)journal.Database.Query("SELECT spool_job_id FROM spooler_calls")[0][0]! == 123 && result.Code == "spooler_accepted", "C4 persists spool job ID without claiming physical confirmation");
            await DeniedAsync(() => adapter.Execute(current, CancellationToken.None), "C4 duplicate dispatch cannot call spooler twice " + scenario);
            journal.Recover(clock.RetentionNow); Check(journal.Pending("result").Single().Result == "ambiguous" && transport.Calls <= 1, "C4 uncertain restart never resubmits " + scenario);
        }
        var interrupted = DirectoryName(); Denied(() => new Journal(interrupted, device, new WindowsProtection(), step => { if (step == 3) throw new BridgeFault("migration_interrupted"); }), "C4 local migration three interruption rolls back only new schema");
        using (var old = new SqliteDatabase(Path.Combine(interrupted, "journal.sqlite"))) { Check((long)old.Query("PRAGMA user_version")[0][0]! == 2 && old.Query("SELECT name FROM sqlite_master WHERE name='spooler_calls'").Count == 0, "C4 failed upgrade preserves complete v2 journal"); old.Execute("INSERT INTO metadata VALUES('c4_preserved','v2')"); }
        using (var resumed = new Journal(interrupted, device, new WindowsProtection())) Check((long)resumed.Database.Query("PRAGMA user_version")[0][0]! == 3 && (string?)resumed.Database.Query("SELECT value FROM metadata WHERE key='c4_preserved'")[0][0] == "v2", "C4 v2 to v3 migration preserves old technical state");
        var queues = WindowsSpooler.LocalQueues(); Check(queues.All(q => !string.IsNullOrEmpty(q)), "C4 actual native Windows enumeration is metadata-only"); var native = new WindowsSpooler().Observe("LIBGUEST_MISSING_" + Guid.NewGuid().ToString("N")); Check(!native.Found, "C4 native nonexistent queue is observed without submission");
        Denied(() => new BridgeOptions { DeviceId = device, CloudBaseUrl = "https://localhost/", WindowsSpoolerEnabled = true, LaboratorySpooler = true }.Validate(), "C4 LAB spool transport cannot be enabled in production");
    }
}
