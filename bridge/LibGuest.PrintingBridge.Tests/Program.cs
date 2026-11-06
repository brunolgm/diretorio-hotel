using System.Net;
using System.Net.Http.Headers;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using LibGuest.PrintingBridge;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Diagnostics;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge.Tests;

internal static partial class Program
{
    private static readonly List<string> Checks = [];
    private static string root = "";
    private static void Check(bool ok, string label) { if (!ok) throw new Exception(label); Checks.Add(label); }
    private static void Denied(Action action, string label) { try { action(); } catch (BridgeFault) { Checks.Add(label); return; } throw new Exception(label); }
    private static async Task DeniedAsync(Func<Task> action, string label) { try { await action(); } catch (BridgeFault) { Checks.Add(label); return; } throw new Exception(label); }
    private static string DirectoryName() { var dir = Path.Combine(root, Guid.NewGuid().ToString("N")); PrivateFiles.DirectoryForIdentity(dir); return dir; }
    private static string ReadShared(string path) { using var file = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete); using var bytes = new MemoryStream(); file.CopyTo(bytes); return Encoding.UTF8.GetString(bytes.ToArray()); }
    private static string Token() => Guid.NewGuid().ToString("D") + "." + Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    private static Dictionary<string, object?> Envelope(Guid? job = null, long fence = 1, int revision = 2, string state = "leased", bool received = false, bool authorized = false, bool recorded = false, bool privateData = false)
    {
        var snapshot = new { payload_version = 1, renderer_version = 1, lines = Array.Empty<object>(), label = "TESTE DE IMPRESSÃO" }; var canonical = JsonSerializer.Serialize(snapshot); var now = DateTimeOffset.UtcNow;
        var value = new Dictionary<string, object?> { ["job_id"] = job ?? Guid.NewGuid(), ["attempt_id"] = Guid.NewGuid(), ["fence"] = fence, ["revision"] = revision, ["kind"] = "test", ["state"] = state, ["received"] = received, ["dispatch_authorized"] = authorized, ["dispatch_recorded"] = recorded, ["protocol_version"] = 1, ["payload_version"] = 1, ["renderer_version"] = 1, ["snapshot"] = snapshot, ["snapshot_canonical"] = canonical, ["snapshot_hash"] = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))), ["lease_until"] = now.AddMinutes(1), ["expires_at"] = now.AddMinutes(15), ["routing"] = new { }, ["reprint"] = false, ["duplicate_risk"] = false };
        if (privateData) value["private"] = new { expired = false, first_name = "C2_PRIVATE_GUEST", room_label = "C2_PRIVATE_ROOM", note = "C2_PRIVATE_NOTE", expires_at = now.AddMinutes(2) }; return value;
    }
    private static JobEnvelope Read(Dictionary<string, object?> value) => JobEnvelope.Parse(JsonSerializer.SerializeToElement(value))!;
    private static Dictionary<string, object?> Advance(Dictionary<string, object?> previous, int revision, string state, bool received, bool authorized, bool recorded, bool privateData = false)
    {
        var result = new Dictionary<string, object?>(previous) { ["revision"] = revision, ["state"] = state, ["received"] = received, ["dispatch_authorized"] = authorized, ["dispatch_recorded"] = recorded };
        if (privateData) result["private"] = new { expired = false, first_name = "C2_PRIVATE_GUEST", room_label = "C2_PRIVATE_ROOM", note = "C2_PRIVATE_NOTE", expires_at = DateTimeOffset.UtcNow.AddMinutes(2) }; return result;
    }
    private sealed class Handler(Func<HttpRequestMessage, HttpResponseMessage> reply) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(reply(request));
    }
    private sealed class UnavailableProtection : IProtection
    {
        public byte[] Protect(byte[] value) => throw new BridgeFault("protection_failed");
        public byte[] Unprotect(byte[] value) => throw new BridgeFault("protection_failed");
    }
    private static HttpResponseMessage Json(object value) => new(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(value), Encoding.UTF8, "application/json") };
    private static BridgeOptions Options(string directory, Guid device) => new() { CloudBaseUrl = "https://localhost:4318/", DeviceId = device, Environment = "laboratory", DataDirectory = directory, SimulatorEnabled = true };
    public static async Task<int> Main(string[] args)
    {
        try
        {
            if (args.Length == 2 && args[0] == "layout-metadata" && LibGuest.PrintingBridge.Printing.SpoolerDestination.ValidQueue(args[1])) { Console.WriteLine(JsonSerializer.Serialize(TicketMetrics.PrinterMetadata(args[1]))); return 0; }
            if (args.Length != 2 || !Path.IsPathFullyQualified(args[1])) throw new Exception("test_arguments_invalid");
            root = args[1]; PrivateFiles.DirectoryForIdentity(root);
            if (args[0] == "certificate") { Certificate(root); return 0; }
            if (args[0] == "inspect") { Inspect(root); return 0; }
            if (args[0] == "hold-lock") { using var held = new SingleInstance(root); Console.WriteLine("locked"); Console.ReadLine(); return 0; }
            if (args[0] == "hold-sqlite") { using var held = new SqliteDatabase(Path.Combine(root, "journal.sqlite")); held.Execute("BEGIN IMMEDIATE"); Console.WriteLine("locked"); Console.ReadLine(); return 0; }
            if (args[0] != "test") throw new Exception("test_arguments_invalid");
            Storage(); Envelopes(); await Http(); await DiscoveryTests(); await Simulator(); await RecoveryClock(); await SpoolerTests(); await RevisionTests(); CancellationTests(); TicketLayoutTests();
            Console.WriteLine(JsonSerializer.Serialize(new { suite = "fb-c2-dotnet", passed = Checks.Count, failed = 0, sqlite = SqliteDatabase.Version, dpapi = "CurrentUser", checks = Checks })); return 0;
        }
        catch (Exception e) { Console.Error.WriteLine(JsonSerializer.Serialize(new { suite = "fb-c2-dotnet", passed = Checks.Count, failed = 1, error = e is BridgeFault fault ? fault.Code : "assertion_failed", last = Checks.LastOrDefault() })); return 1; }
    }
    private static void Storage()
    {
        var protection = new WindowsProtection(); var dir = DirectoryName(); var device = Guid.NewGuid();
        var sample = Encoding.UTF8.GetBytes("C2_PRIVATE_TEST_SECRET"); var cipher = protection.Protect(sample); Check(!cipher.AsSpan().SequenceEqual(sample) && protection.Unprotect(cipher).AsSpan().SequenceEqual(sample), "DPAPI CurrentUser real roundtrip"); Denied(() => protection.Unprotect([1, 2, 3, 4]), "corrupt DPAPI fails closed");
        var sid = WindowsIdentity.GetCurrent().User!; var acl = new DirectoryInfo(dir).GetAccessControl(); Check(acl.AreAccessRulesProtected && acl.GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().All(a => a.IdentityReference.Equals(sid)), "data directory has only service-identity ACL");
        var credential = Token(); var vault = new CredentialVault(dir, device, protection); vault.Save(credential); Check(vault.Load() == credential, "credential protected store roundtrip"); Check(!Encoding.UTF8.GetString(File.ReadAllBytes(Path.Combine(dir, "credential.dpapi"))).Contains(credential, StringComparison.Ordinal), "credential never stored as plaintext");
        var before = File.ReadAllBytes(Path.Combine(dir, "credential.dpapi")); Denied(() => vault.Save("bad"), "invalid credential rejected"); Check(File.ReadAllBytes(Path.Combine(dir, "credential.dpapi")).AsSpan().SequenceEqual(before), "bad replacement leaves old protected credential intact"); Denied(() => new CredentialVault(dir, Guid.NewGuid(), protection).Load(), "credential bound to device");
        foreach (var invalid in new[] { "", Guid.NewGuid().ToString(), credential + "x", "Bearer " + credential, credential[..37] + new string('=', 43) }) Check(!CredentialVault.IsValidToken(invalid), "opaque credential format rejects invalid input");
        using (var first = new SingleInstance(dir)) Denied(() => new SingleInstance(dir), "second instance cannot acquire journal lock"); using (var later = new SingleInstance(dir)) Check(true, "lock released after process owner closes");
        using (var journal = new Journal(dir, device, protection))
        {
            Check((long)journal.Database.Query("PRAGMA user_version")[0][0]! == 3, "new SQLite migration version three"); Check((string?)journal.Database.Query("PRAGMA journal_mode")[0][0] == "wal", "SQLite WAL enabled"); Check((long)journal.Database.Query("PRAGMA synchronous")[0][0]! == 2, "SQLite synchronous FULL"); Check((long)journal.Database.Query("PRAGMA foreign_keys")[0][0]! == 1, "SQLite foreign keys enabled");
            try { journal.Database.Transaction(() => { journal.Database.Execute("INSERT INTO metadata VALUES('rollback','x')"); throw new BridgeFault("injected"); }); } catch (BridgeFault) { }
            Check(journal.Database.Query("SELECT value FROM metadata WHERE key='rollback'").Count == 0, "transaction rollback preserves atomicity");
            Parallel.For(0, 40, i => journal.Database.Execute("INSERT INTO metadata(key,value) VALUES(?,?)", "concurrent_" + i, "ok")); Check((long)journal.Database.Query("SELECT count(*) FROM metadata WHERE key LIKE 'concurrent_%'")[0][0]! == 40, "concurrent internal writes serialized without loss");
            var keys = new Guid[20]; Parallel.For(0, keys.Length, i => keys[i] = journal.BeginClaim()); Check(keys.Distinct().Count() == 1, "concurrent pending claim uses one durable request key"); journal.CompleteEmptyClaim(keys[0]);
            var raw = Envelope(); var envelope = Read(raw); var key = journal.BeginClaim(); journal.Receive(envelope, key, DateTimeOffset.UtcNow);
            Check(journal.Pending("receipt").Count == 1 && journal.Pending("claim").Count == 0, "job and receipt outbox commit together"); Check(journal.ReadProtectedContent(envelope.JobId, 1, false) is not null, "claim payload committed before receipt");
            var job = journal.Get(envelope.JobId, 1); Denied(() => journal.Intent(job, DateTimeOffset.UtcNow), "intent forbidden before authorization"); Denied(() => journal.RecordResult(job, "confirmed", "physical", false, DateTimeOffset.UtcNow), "physical confirmed result cannot be fabricated");
            var received = Read(Advance(raw, 3, "leased", true, false, false)); journal.ReceiptConfirmed(job, received, DateTimeOffset.UtcNow); job = journal.Get(envelope.JobId, 1); journal.RequestDispatch(job);
            var authorized = Read(Advance(raw, 4, "dispatching", true, true, true, true)); journal.Authorized(job, authorized, DateTimeOffset.UtcNow); job = journal.Get(envelope.JobId, 1);
            var encrypted = journal.ReadProtectedContent(envelope.JobId, 1, true)!; Check(!Encoding.UTF8.GetString(encrypted).Contains("C2_PRIVATE_GUEST", StringComparison.Ordinal), "private projection encrypted in SQLite"); Check(Encoding.UTF8.GetString(protection.Unprotect(encrypted)).Contains("C2_PRIVATE_GUEST", StringComparison.Ordinal), "actual DPAPI decrypts permitted projection");
            Denied(() => journal.ReceiptConfirmed(job, received, DateTimeOffset.UtcNow), "out-of-order lower revision rejected"); journal.Intent(job, DateTimeOffset.UtcNow); Denied(() => journal.Intent(job, DateTimeOffset.UtcNow), "duplicate dispatch intent rejected durably");
            job = journal.Get(envelope.JobId, 1); journal.EnterSimulator(job, "success", DateTimeOffset.UtcNow); Denied(() => journal.EnterSimulator(job, "success", DateTimeOffset.UtcNow), "second simulator execution blocked by durable uniqueness");
            journal.Recover(DateTimeOffset.UtcNow); var pending = journal.Pending("result").Single(); Check(pending.Result == "ambiguous" && !pending.NoIo, "intent with no result recovers as ambiguity");
            var keyBeforeRestart = pending.Key; journal.ClearPrivate(); Check(journal.ReadProtectedContent(envelope.JobId, 1, true) is null, "private material purged separately from tombstone");
            Check(journal.Pending("result").Single().Key == keyBeforeRestart, "ACK pending key stable during recovery");
            var ambiguous = Read(Advance(raw, 5, "ambiguous", true, false, true)); journal.ResultAcknowledged(journal.Get(envelope.JobId, 1), ambiguous, "ambiguous", DateTimeOffset.UtcNow); Check(journal.Pending().Count == 0 && journal.Get(envelope.JobId, 1).LocalState == "terminal", "result ACK leaves terminal technical tombstone");
            Denied(() => journal.Receive(Read(raw), journal.BeginClaim(), DateTimeOffset.UtcNow), "terminal same job/fence replay rejected"); Denied(() => journal.Receive(Read(Envelope(envelope.JobId, 2)), Guid.NewGuid(), DateTimeOffset.UtcNow), "new fence cannot bypass possible prior I/O");
            journal.Purge(DateTimeOffset.UtcNow.AddDays(181)); Check((long)journal.Database.Query("SELECT count(*) FROM jobs")[0][0]! == 0, "technical retention bounded to 180 days");
        }
        using (var reopened = new Journal(dir, device, protection)) Check((string?)reopened.Database.Query("PRAGMA integrity_check")[0][0] == "ok", "journal reopens with intact integrity");
        var interrupted = DirectoryName(); Denied(() => new Journal(interrupted, device, protection, step => { if (step == 2) throw new BridgeFault("migration_interrupted"); }), "interrupted incremental migration fails closed");
        using (var v1 = new SqliteDatabase(Path.Combine(interrupted, "journal.sqlite"))) { Check((long)v1.Query("PRAGMA user_version")[0][0]! == 1 && v1.Query("SELECT name FROM sqlite_master WHERE name='outbox'").Count == 0, "interrupted migration leaves committed v1 and no partial v2"); v1.Execute("INSERT INTO metadata VALUES('preserved','before_upgrade')"); }
        using (var upgraded = new Journal(interrupted, device, protection)) Check((long)upgraded.Database.Query("PRAGMA user_version")[0][0]! == 3 && (string?)upgraded.Database.Query("SELECT value FROM metadata WHERE key='preserved'")[0][0] == "before_upgrade", "incremental migration preserves existing state");
        var initialFault = DirectoryName(); Denied(() => new Journal(initialFault, device, protection, _ => throw new BridgeFault("migration_interrupted")), "initial migration rollback"); using (var restarted = new Journal(initialFault, device, protection)) Check((long)restarted.Database.Query("PRAGMA user_version")[0][0]! == 3, "new database recovers from interrupted first migration");
        var unknown = DirectoryName(); using (var known = new Journal(unknown, device, protection)) known.Database.Execute("PRAGMA user_version=99"); Denied(() => new Journal(unknown, device, protection), "unknown schema blocks without reset"); using (var unchanged = new SqliteDatabase(Path.Combine(unknown, "journal.sqlite"))) Check((long)unchanged.Query("PRAGMA user_version")[0][0]! == 99, "unknown version not overwritten");
        var foreign = DirectoryName(); using (var other = new SqliteDatabase(Path.Combine(foreign, "journal.sqlite"))) other.Execute("CREATE TABLE foreign_data(value TEXT)"); Denied(() => new Journal(foreign, device, protection), "foreign database not recreated");
        var corrupt = DirectoryName(); File.WriteAllBytes(Path.Combine(corrupt, "journal.sqlite"), RandomNumberGenerator.GetBytes(1024)); Denied(() => new Journal(corrupt, device, protection), "corrupt SQLite blocks without reset");
        var mismatched = DirectoryName(); using (var existing = new Journal(mismatched, device, protection)) { } Denied(() => new Journal(mismatched, Guid.NewGuid(), protection), "journal cannot move to another device silently");
        using (var failed = new Journal(DirectoryName(), device, new UnavailableProtection()))
        {
            var key = failed.BeginClaim(); Denied(() => failed.Receive(Read(Envelope()), key, DateTimeOffset.UtcNow), "protection failure prevents persistence");
            Check(failed.Active().Count == 0 && failed.Pending("receipt").Count == 0 && failed.Pending("claim").Single().Key == key, "failed persistence cannot queue receipt ACK");
        }
        var ttlDir = DirectoryName();
        using (var ttl = new Journal(ttlDir, device, protection))
        {
            var now = DateTimeOffset.UtcNow; var raw = Envelope(); raw["expires_at"] = now.AddDays(2); var envelope = Read(raw); ttl.Receive(envelope, ttl.BeginClaim(), now);
            var job = ttl.Get(envelope.JobId, 1); var received = Read(Advance(raw, 3, "leased", true, false, false)); ttl.ReceiptConfirmed(job, received, now); job = ttl.Get(envelope.JobId, 1); ttl.RequestDispatch(job);
            var authorized = Advance(raw, 4, "dispatching", true, true, true); authorized["private"] = new { first_name = "C2_PRIVATE_GUEST", expires_at = now.AddDays(3) }; ttl.Authorized(job, Read(authorized), now);
            Check(ttl.Database.Query("SELECT expires_at FROM contents").All(row => DateTimeOffset.Parse((string)row[0]!) <= now.AddHours(24)), "every encrypted payload capped at 24 hours");
            job = ttl.Get(envelope.JobId, 1); ttl.Intent(job, now); job = ttl.Get(envelope.JobId, 1); var completed = 0;
            Parallel.For(0, 20, _ => { try { ttl.RecordResult(job, "ambiguous", "unknown_after_send", false, now); Interlocked.Increment(ref completed); } catch (BridgeFault) { } });
            Check(completed == 1 && ttl.Pending("result").Count == 1, "concurrent result writers commit exactly one outcome and ACK");
            Denied(() => ttl.EnterSimulator(job, "success", now), "terminal pending result cannot enter simulator after restart");
            Check(Directory.GetFiles(ttlDir, "journal.sqlite*").All(file => !ReadShared(file).Contains("C2_PRIVATE_GUEST", StringComparison.Ordinal)), "guest marker absent from actual SQLite and WAL plaintext");
            ttl.Purge(now.AddHours(24).AddSeconds(1)); Check(ttl.Database.Query("SELECT job_id FROM contents").Count == 0 && ttl.Get(envelope.JobId, 1).JobId == envelope.JobId, "private TTL purge preserves technical deduplication");
        }
        using (var sourceTtl = new Journal(DirectoryName(), device, protection))
        {
            var raw = Envelope(); var envelope = Read(raw); sourceTtl.Receive(envelope, sourceTtl.BeginClaim(), DateTimeOffset.UtcNow); sourceTtl.Purge(envelope.ExpiresAt.AddSeconds(1)); Check(sourceTtl.ReadProtectedContent(envelope.JobId, 1, false) is null, "earlier source expiration wins over 24-hour cap");
        }
    }
    private static void Envelopes()
    {
        var raw = Envelope(); Check(Read(raw).Fence == 1, "canonical snapshot accepted");
        foreach (var field in new[] { "protocol_version", "payload_version", "renderer_version" }) { var wrong = new Dictionary<string, object?>(raw) { [field] = 2 }; Denied(() => Read(wrong), "incompatible " + field + " rejected"); }
        Denied(() => Read(new(raw) { ["snapshot_hash"] = new string('0', 64) }), "hash mismatch rejected"); Denied(() => Read(new(raw) { ["snapshot"] = new { payload_version = 1, renderer_version = 1, lines = new[] { "tampered" } } }), "canonical/object mismatch rejected"); Denied(() => Read(new(raw) { ["hotel_id"] = Guid.NewGuid() }), "unexpected authority field rejected"); Denied(() => Read(new(raw) { ["fence"] = 0 }), "nonpositive fence rejected"); Denied(() => Read(new(raw) { ["state"] = "confirmed" }), "physical confirmed envelope rejected");
        var clock = new CloudClock(); Check(!clock.IsFresh, "clock requires server synchronization"); var historical = new DateTimeOffset(1900, 1, 1, 0, 0, 0, TimeSpan.Zero); clock.Synchronize(historical); Check(clock.Permits(historical.AddMinutes(1), historical.AddMinutes(2)), "lease uses server anchor independent of local wall clock"); Check(!clock.Permits(historical.AddSeconds(-1), historical.AddMinutes(2)), "expired server lease refused");
        var logDir = DirectoryName(); var logger = new BoundedLog(logDir, 512); for (var i = 0; i < 100; i++) logger.Write(EventCode.NetworkBackoff, error: "C2_PRIVATE_NOTE with secret"); Check(Directory.GetFiles(logDir).Length <= 3 && Directory.GetFiles(logDir).All(f => new FileInfo(f).Length <= 512), "logs rotated within fixed bounds"); Check(Directory.GetFiles(logDir).All(f => !File.ReadAllText(f).Contains("C2_PRIVATE_NOTE", StringComparison.Ordinal)), "logs cannot echo arbitrary private/error strings");
    }
    private static async Task Http()
    {
        var dir = DirectoryName(); var device = Guid.NewGuid(); var options = Options(dir, device); var vault = new CredentialVault(dir, device, new WindowsProtection()); var token = Token(); vault.Save(token); var clock = new CloudClock();
        Denied(() => new BridgeOptions { DeviceId = device, CloudBaseUrl = "http://localhost/", Environment = "laboratory", DataDirectory = dir }.Validate(), "HTTP base URL refused"); Denied(() => new BridgeOptions { DeviceId = device, CloudBaseUrl = "https://localhost/", SimulatorEnabled = true }.Validate(), "production cannot enable simulator"); Denied(() => new LaboratorySimulator(new BridgeOptions { DeviceId = device, CloudBaseUrl = "https://localhost/" }), "production cannot instantiate simulator");
        var config = Path.Combine(dir, "bad.json"); File.WriteAllText(config, "{\"cloud_base_url\":\"https://localhost/\",\"device_id\":\"" + device + "\",\"hotel_id\":\"forged\"}"); Denied(() => BridgeOptions.Load(config), "local hotel authority configuration refused");
        using (var client = new CloudClient(options, vault, clock, new Handler(request => { Check(request.Headers.Authorization?.Scheme == "Bearer" && request.Headers.Authorization.Parameter == token, "HTTP sends only scoped device bearer"); Check(request.RequestUri!.AbsolutePath == "/api/fb/printing/device/heartbeat", "real C1 operation path used"); return Json(new { device_id = device, server_time = DateTimeOffset.UtcNow, compatible = true, printer_ready = (bool?)null }); }))) { await client.Heartbeat(CancellationToken.None); Check(clock.IsFresh, "heartbeat calibrates server clock without printer-readiness claim"); }
        foreach (var status in new[] { 403, 409, 410, 429, 503, 302 }) using (var client = new CloudClient(options, vault, clock, new Handler(_ => new HttpResponseMessage((HttpStatusCode)status) { Content = new StringContent("PRIVATE_SECRET") }))) await DeniedAsync(() => client.Heartbeat(CancellationToken.None), "HTTP " + status + " sanitized/rejected without response body");
        using (var client = new CloudClient(options, vault, clock, new Handler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("invalid-json", Encoding.UTF8, "application/json") }))) await DeniedAsync(() => client.Heartbeat(CancellationToken.None), "malformed JSON refused");
        using (var client = new CloudClient(options, vault, clock, new Handler(_ => new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent(new byte[4 * 1024 * 1024 + 1]) { Headers = { ContentType = new MediaTypeHeaderValue("application/json") } } }))) await DeniedAsync(() => client.Heartbeat(CancellationToken.None), "oversized response refused");
        var newToken = Token(); using (var client = new CloudClient(options, vault, clock, new Handler(_ => new HttpResponseMessage(HttpStatusCode.Forbidden)))) await DeniedAsync(() => client.ImportCredential(newToken, CancellationToken.None), "invalid rotation not committed"); Check(vault.Load() == token, "failed rotation preserves protected old credential");
        using (var client = new CloudClient(options, vault, clock, new Handler(_ => Json(new { device_id = device, credential_id = Guid.Parse(newToken[..36]), protocol_version = 1, expires_at = DateTimeOffset.UtcNow.AddDays(90), credential = newToken })))) await client.Pair(Token(), true, CancellationToken.None); Check(vault.Load() == newToken, "pairing immediately persists only protected new credential");
    }
    private static async Task Simulator()
    {
        var device = Guid.NewGuid(); var dir = DirectoryName(); var jobValue = Read(Envelope()); var job = new JournalJob(jobValue.JobId, jobValue.AttemptId, 1, 4, jobValue.Hash, "test", "dispatching", jobValue.LeaseUntil, jobValue.ExpiresAt, "intent", true, null);
        foreach (var scenario in new[] { "success", "safe_failure", "ambiguous", "delay", "no_response" })
        {
            var options = new BridgeOptions { CloudBaseUrl = "https://localhost/", DeviceId = device, Environment = "laboratory", DataDirectory = dir, SimulatorEnabled = true, SimulatorScenario = scenario, SimulatorDelayMilliseconds = 0 };
            var result = await new LaboratorySimulator(options).Execute(job, CancellationToken.None); Check(result.Result != "confirmed" && (scenario != "safe_failure" || result.NoIo), "deterministic LAB simulator " + scenario);
        }
        await DeniedAsync(() => new LaboratorySimulator(Options(dir, device)).Execute(job with { Intent = false }, CancellationToken.None), "simulator cannot run without durable intent");
    }
    private static async Task RecoveryClock()
    {
        var dir = DirectoryName(); var device = Guid.NewGuid(); var options = Options(dir, device); var protection = new WindowsProtection(); var vault = new CredentialVault(dir, device, protection); vault.Save(Token());
        var historical = new DateTimeOffset(1900, 1, 1, 0, 0, 0, TimeSpan.Zero); var raw = Envelope(); raw["lease_until"] = historical.AddMinutes(1); raw["expires_at"] = historical.AddMinutes(15); var envelope = Read(raw);
        using (var original = new Journal(dir, device, protection))
        {
            original.Receive(envelope, original.BeginClaim(historical), historical); var job = original.Get(envelope.JobId, 1); original.ReceiptConfirmed(job, Read(Advance(raw, 3, "leased", true, false, false)), historical); job = original.Get(envelope.JobId, 1); original.RequestDispatch(job); original.Authorized(job, Read(Advance(raw, 4, "dispatching", true, true, true, true)), historical); job = original.Get(envelope.JobId, 1); original.Intent(job, historical); original.RecordResult(job, "submitted", "transport_accepted", false, historical);
        }
        using var recovered = new Journal(dir, device, protection);
        Check(recovered.Pending("result").Count == 1 && recovered.Database.Query("SELECT job_id FROM contents").Count == 0, "startup removes all payloads while preserving pending ACK and tombstone");
        var operations = new List<string>(); var clock = new CloudClock();
        using var client = new CloudClient(options, vault, clock, new Handler(request =>
        {
            var operation = request.RequestUri!.AbsolutePath.Split('/').Last(); operations.Add(operation);
            return operation switch { "result" => Json(Advance(raw, 5, "submitted", true, false, true)), "heartbeat" => Json(new { device_id = device, server_time = historical, compatible = true, printer_ready = (bool?)null }), _ => throw new Exception("unexpected_operation") };
        }));
        using var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(10)); await new BridgeWorker(options, recovered, client, clock, new BoundedLog(Path.Combine(dir, "logs"))).Run(true, cancel.Token);
        Check(operations.SequenceEqual(new[] { "result", "heartbeat" }), "pending result drains before heartbeat and never claims new work");
        Check(recovered.Get(envelope.JobId, 1).LocalState == "terminal" && recovered.Pending().Count == 0, "wrong workstation clock cannot purge unacknowledged intent before server synchronization");
        Check((long)recovered.Database.Query("SELECT count(*) FROM simulator_calls")[0][0]! == 0, "historical-clock ACK recovery never calls simulator");
    }
    private static void Certificate(string directory)
    {
        using var rsa = RSA.Create(2048); var request = new CertificateRequest("CN=localhost", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1); var san = new SubjectAlternativeNameBuilder(); san.AddDnsName("localhost"); san.AddIpAddress(IPAddress.Loopback); request.CertificateExtensions.Add(san.Build()); request.CertificateExtensions.Add(new X509BasicConstraintsExtension(true, false, 0, true));
        using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-5), DateTimeOffset.UtcNow.AddDays(2)); PrivateFiles.WriteAtomic(Path.Combine(directory, "certificate.pem"), Encoding.ASCII.GetBytes(certificate.ExportCertificatePem())); PrivateFiles.WriteAtomic(Path.Combine(directory, "key.pem"), Encoding.ASCII.GetBytes(rsa.ExportPkcs8PrivateKeyPem())); Console.WriteLine(JsonSerializer.Serialize(new { sha256 = Convert.ToHexStringLower(SHA256.HashData(certificate.RawData)) }));
    }
    private static void Inspect(string directory)
    {
        using var db = new SqliteDatabase(Path.Combine(directory, "journal.sqlite")); var jobs = db.Query("SELECT job_id,fence,local_state,intent,result,revision FROM jobs").Select(r => new { job_id = r[0], fence = r[1], state = r[2], intent = r[3], result = r[4], revision = r[5] }); Console.WriteLine(JsonSerializer.Serialize(new { jobs, pending = db.Query("SELECT operation,count(*) FROM outbox GROUP BY operation").Select(r => new { operation = r[0], count = r[1] }), simulator_calls = db.Query("SELECT count(*) FROM simulator_calls")[0][0], spooler_calls = db.Query("SELECT job_id,fence,spool_job_id,observation,submitted_at FROM spooler_calls").Select(r => new { job_id=r[0], fence=r[1], spool_job_id=r[2], observation=r[3], submitted_at=r[4] }), contents = db.Query("SELECT count(*) FROM contents")[0][0], private_contents = db.Query("SELECT count(*) FROM contents WHERE is_private=1")[0][0] }));
    }
}
