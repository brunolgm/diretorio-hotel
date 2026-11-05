using System.Globalization;
using System.Security.Cryptography;
using LibGuest.PrintingBridge.Cloud;

namespace LibGuest.PrintingBridge.Storage;

public sealed record JournalJob(Guid JobId, Guid AttemptId, long Fence, int Revision, string Hash, string Kind, string CloudState, DateTimeOffset LeaseUntil, DateTimeOffset ExpiresAt, string LocalState, bool Intent, string? Result);
public sealed record PendingOperation(string Operation, Guid? JobId, long Fence, Guid Key, string? Result, string? Code, bool NoIo);

public sealed class Journal : IDisposable
{
    internal readonly SqliteDatabase Database;
    private readonly IProtection protection;
    private readonly Guid device;
    private const int ApplicationId = 0x4C474232;
    private const string Columns = "job_id,attempt_id,fence,revision,hash,kind,cloud_state,lease_until,expires_at,local_state,intent,result";
    public Journal(string directory, Guid device, IProtection protection, Action<int>? laboratoryMigrationFault = null)
    {
        this.device = device; this.protection = protection; Database = new SqliteDatabase(Path.Combine(directory, "journal.sqlite"));
        try
        {
            Migrate(laboratoryMigrationFault);
            var previous = Database.Query("SELECT value FROM metadata WHERE key='device_id'");
            if (previous.Count != 0 && (string?)previous[0][0] != device.ToString("D")) throw new BridgeFault("journal_device_mismatch");
            Database.Execute("INSERT OR IGNORE INTO metadata(key,value) VALUES('device_id',?)", device.ToString("D"));
            Database.Execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('bridge_version',?)", BridgeVersion.Current);
            Database.Execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('protocol_version','1')");
            // No content crosses an uncalibrated reboot clock; ACK metadata remains.
            Database.Execute("DELETE FROM contents");
        }
        catch { Database.Dispose(); throw; }
    }
    private void Migrate(Action<int>? fault)
    {
        var version = (long)Database.Query("PRAGMA user_version")[0][0]!;
        var application = (long)Database.Query("PRAGMA application_id")[0][0]!;
        if (version > 3 || (application != 0 && application != ApplicationId) || (version == 0 && Database.Query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").Count != 0)) throw new BridgeFault("journal_version_incompatible");
        if (version > 0 && application != ApplicationId) throw new BridgeFault("journal_version_incompatible");
        if (version < 1) Database.Transaction(() =>
        {
            Database.Execute("CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
            Database.Execute("CREATE TABLE jobs(job_id TEXT NOT NULL,attempt_id TEXT NOT NULL,fence INTEGER NOT NULL CHECK(fence>0),revision INTEGER NOT NULL,hash TEXT NOT NULL,kind TEXT NOT NULL,cloud_state TEXT NOT NULL,lease_until TEXT NOT NULL,expires_at TEXT NOT NULL,local_state TEXT NOT NULL,intent INTEGER NOT NULL DEFAULT 0,result TEXT,first_seen TEXT NOT NULL,retain_until TEXT NOT NULL,PRIMARY KEY(job_id,fence))");
            Database.Execute("CREATE TABLE contents(job_id TEXT NOT NULL,fence INTEGER NOT NULL,is_private INTEGER NOT NULL,body BLOB NOT NULL,expires_at TEXT NOT NULL,PRIMARY KEY(job_id,fence,is_private),FOREIGN KEY(job_id,fence) REFERENCES jobs(job_id,fence) ON DELETE CASCADE)");
            Database.Execute("CREATE TABLE events(id INTEGER PRIMARY KEY,job_id TEXT,fence INTEGER,code TEXT NOT NULL,created_at TEXT NOT NULL)");
            fault?.Invoke(1); Database.Execute("PRAGMA application_id=" + ApplicationId.ToString(CultureInfo.InvariantCulture)); Database.Execute("PRAGMA user_version=1");
        });
        if (version < 2) Database.Transaction(() =>
        {
            Database.Execute("CREATE TABLE outbox(operation TEXT NOT NULL,job_id TEXT,fence INTEGER NOT NULL DEFAULT 0,key TEXT NOT NULL UNIQUE,result TEXT,code TEXT,no_io INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,PRIMARY KEY(operation,job_id,fence))");
            Database.Execute("CREATE UNIQUE INDEX one_claim ON outbox(operation) WHERE operation='claim'");
            Database.Execute("CREATE TABLE simulator_calls(job_id TEXT NOT NULL,fence INTEGER NOT NULL,scenario TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(job_id,fence))");
            Database.Execute("CREATE INDEX jobs_retention ON jobs(retain_until)");
            Database.Execute("CREATE INDEX contents_expiry ON contents(expires_at)");
            fault?.Invoke(2); Database.Execute("PRAGMA user_version=2");
        });
        if (version < 3) Database.Transaction(() =>
        {
            Database.Execute("CREATE TABLE spooler_calls(job_id TEXT NOT NULL,fence INTEGER NOT NULL,printer_id TEXT NOT NULL,printer_revision INTEGER NOT NULL,queue_name TEXT NOT NULL,spool_job_id INTEGER,observation TEXT NOT NULL DEFAULT 'unknown',created_at TEXT NOT NULL,submitted_at TEXT,PRIMARY KEY(job_id,fence))");
            fault?.Invoke(3); Database.Execute("PRAGMA user_version=3");
        });
        if ((string?)Database.Query("PRAGMA integrity_check")[0][0] != "ok") throw new BridgeFault("journal_corrupt");
    }
    public static string Time(DateTimeOffset value) => value.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture);
    private static DateTimeOffset ParseTime(object? value) => DateTimeOffset.Parse((string)value!, CultureInfo.InvariantCulture);
    private static JournalJob Map(object?[] r) => new(Guid.Parse((string)r[0]!), Guid.Parse((string)r[1]!), (long)r[2]!, checked((int)(long)r[3]!), (string)r[4]!, (string)r[5]!, (string)r[6]!, ParseTime(r[7]), ParseTime(r[8]), (string)r[9]!, (long)r[10]! == 1, (string?)r[11]);
    public JournalJob Get(Guid id, long fence) => Database.Query("SELECT " + Columns + " FROM jobs WHERE job_id=? AND fence=?", id.ToString("D"), fence).Select(Map).SingleOrDefault() ?? throw new BridgeFault("journal_job_missing");
    public IReadOnlyList<JournalJob> Active() => Database.Query("SELECT " + Columns + " FROM jobs WHERE local_state NOT IN('terminal','blocked','expired') ORDER BY first_seen,job_id,fence").Select(Map).ToArray();
    public IReadOnlyList<PendingOperation> Pending(string? operation = null) => Database.Query("SELECT operation,job_id,fence,key,result,code,no_io FROM outbox" + (operation is null ? "" : " WHERE operation=?") + " ORDER BY CASE operation WHEN 'result' THEN 0 WHEN 'receipt' THEN 1 WHEN 'dispatch' THEN 2 ELSE 3 END", operation is null ? [] : [operation]).Select(r => new PendingOperation((string)r[0]!, r[1] is string id ? Guid.Parse(id) : null, (long)r[2]!, Guid.Parse((string)r[3]!), (string?)r[4], (string?)r[5], (long)r[6]! == 1)).ToArray();
    public Guid BeginClaim(DateTimeOffset? now = null)
    {
        var key = Guid.Empty; Database.Transaction(() => { var pending = Pending("claim").FirstOrDefault(); if (pending is not null) { key = pending.Key; return; } key = Guid.NewGuid(); Database.Execute("INSERT INTO outbox(operation,key,created_at) VALUES('claim',?,?)", key.ToString("D"), Time(now ?? DateTimeOffset.UtcNow)); }); return key;
    }
    public void CompleteEmptyClaim(Guid key) => Database.Execute("DELETE FROM outbox WHERE operation='claim' AND key=?", key.ToString("D"));
    public void Receive(JobEnvelope value, Guid claimKey, DateTimeOffset now)
    {
        var protectedBody = protection.Protect(value.Content);
        Database.Transaction(() =>
        {
            var existing = Database.Query("SELECT " + Columns + " FROM jobs WHERE job_id=? ORDER BY fence DESC", value.JobId.ToString("D")).Select(Map).ToArray();
            if (existing.Any(j => j.Fence > value.Fence || (j.Fence == value.Fence && (j.AttemptId != value.AttemptId || j.Hash != value.Hash)) || (j.Intent && j.Result != "pre_send_failed" && j.Fence != value.Fence))) throw new BridgeFault("job_replay_blocked");
            if (existing.Any(j => j.Fence == value.Fence && j.LocalState is "terminal" or "blocked" or "expired")) throw new BridgeFault("job_replay_blocked");
            Database.Execute("INSERT OR IGNORE INTO jobs(job_id,attempt_id,fence,revision,hash,kind,cloud_state,lease_until,expires_at,local_state,first_seen,retain_until) VALUES(?,?,?,?,?,?,?,?,?,'received',?,?)", value.JobId.ToString("D"), value.AttemptId.ToString("D"), value.Fence, value.Revision, value.Hash, value.Kind, value.State, Time(value.LeaseUntil), Time(value.ExpiresAt), Time(now), Time(now.AddDays(180)));
            Database.Execute("INSERT OR REPLACE INTO contents(job_id,fence,is_private,body,expires_at) VALUES(?,?,0,?,?)", value.JobId.ToString("D"), value.Fence, protectedBody, Time(Min(value.ExpiresAt, now.AddHours(24))));
            Database.Execute("DELETE FROM outbox WHERE operation='claim' AND key=?", claimKey.ToString("D"));
            Queue("receipt", value.JobId, value.Fence); Event(value.JobId, value.Fence, "received_committed", now);
        });
    }
    private static DateTimeOffset Min(DateTimeOffset a, DateTimeOffset b) => a < b ? a : b;
    private void Queue(string op, Guid id, long fence, string? result = null, string? code = null, bool noIo = false) => Database.Execute("INSERT OR IGNORE INTO outbox(operation,job_id,fence,key,result,code,no_io,created_at) VALUES(?,?,?,?,?,?,?,?)", op, id.ToString("D"), fence, Guid.NewGuid().ToString("D"), result, code, noIo, Time(DateTimeOffset.UtcNow));
    private void Event(Guid id, long fence, string code, DateTimeOffset now) => Database.Execute("INSERT INTO events(job_id,fence,code,created_at) VALUES(?,?,?,?)", id.ToString("D"), fence, code, Time(now));
    public static void Match(JournalJob job, JobEnvelope response)
    {
        if (job.JobId != response.JobId || job.AttemptId != response.AttemptId || job.Fence != response.Fence || job.Hash != response.Hash || response.Revision < job.Revision || job.Kind != response.Kind) throw new BridgeFault("response_out_of_order");
    }
    public void ReceiptConfirmed(JournalJob job, JobEnvelope response, DateTimeOffset now)
    {
        Match(job, response); if (!response.Received || response.State != "leased" || response.DispatchRecorded) throw new BridgeFault("receipt_state_incompatible");
        Database.Transaction(() => { Update(job, response, "receipted"); Database.Execute("DELETE FROM outbox WHERE operation='receipt' AND job_id=? AND fence=?", job.JobId.ToString("D"), job.Fence); Event(job.JobId, job.Fence, "receipt_confirmed", now); });
    }
    private void Update(JournalJob job, JobEnvelope response, string state)
    {
        Match(Get(job.JobId, job.Fence), response);
        Database.Execute("UPDATE jobs SET revision=?,cloud_state=?,lease_until=?,expires_at=?,local_state=? WHERE job_id=? AND fence=?", response.Revision, response.State, Time(response.LeaseUntil), Time(response.ExpiresAt), state, job.JobId.ToString("D"), job.Fence);
    }
    public void RequestDispatch(JournalJob job)
    {
        if (job.Intent || job.LocalState != "receipted") throw new BridgeFault("dispatch_out_of_order");
        Database.Transaction(() => { Queue("dispatch", job.JobId, job.Fence); Database.Execute("UPDATE jobs SET local_state='authorization_pending' WHERE job_id=? AND fence=?", job.JobId.ToString("D"), job.Fence); });
    }
    public void Authorized(JournalJob job, JobEnvelope response, DateTimeOffset now)
    {
        Match(job, response); if (job.Intent || !response.Received || !response.Authorized || response.State != "dispatching") throw new BridgeFault("authorization_invalid");
        var body = protection.Protect(response.Content);
        Database.Transaction(() =>
        {
            Update(job, response, "authorized"); Database.Execute("INSERT OR REPLACE INTO contents(job_id,fence,is_private,body,expires_at) VALUES(?,?,1,?,?)", job.JobId.ToString("D"), job.Fence, body, Time(Min(Min(response.PrivateExpiresAt ?? response.ExpiresAt, response.ExpiresAt), now.AddHours(24))));
            Database.Execute("DELETE FROM outbox WHERE operation='dispatch' AND job_id=? AND fence=?", job.JobId.ToString("D"), job.Fence); Event(job.JobId, job.Fence, "authorization_committed", now);
        });
    }
    public void Intent(JournalJob job, DateTimeOffset now)
    {
        if (job.LocalState != "authorized" || job.Intent) throw new BridgeFault("dispatch_intent_invalid");
        Database.Transaction(() => { var current = Get(job.JobId, job.Fence); if (current.Intent || current.LocalState != "authorized") throw new BridgeFault("dispatch_intent_invalid"); Database.Execute("UPDATE jobs SET intent=1,local_state='intent' WHERE job_id=? AND fence=? AND intent=0", job.JobId.ToString("D"), job.Fence); Event(job.JobId, job.Fence, "dispatch_intent", now); });
    }
    public void EnterSimulator(JournalJob job, string scenario, DateTimeOffset now)
    {
        var current = Get(job.JobId, job.Fence);
        if (!current.Intent || current.LocalState != "intent" || current.Result is not null) throw new BridgeFault("dispatch_intent_required");
        Database.Execute("INSERT INTO simulator_calls(job_id,fence,scenario,created_at) VALUES(?,?,?,?)", job.JobId.ToString("D"), job.Fence, scenario, Time(now));
    }
    public void RecordResult(JournalJob job, string result, string code, bool noIo, DateTimeOffset now)
    {
        if (result is not ("submitted" or "pre_send_failed" or "ambiguous") || (noIo && result != "pre_send_failed") || (!noIo && result == "pre_send_failed")) throw new BridgeFault("result_invalid");
        Database.Transaction(() => {
            var current = Get(job.JobId, job.Fence);
            if (!current.Intent || current.Result is not null || (result == "submitted" && code is not ("transport_accepted" or "spooler_accepted")) || (result == "ambiguous" && code != "unknown_after_send") || (result == "pre_send_failed" && code is not ("no_io" or "connection_unavailable"))) throw new BridgeFault("result_invalid");
            Database.Execute("UPDATE jobs SET result=?,local_state='result_pending' WHERE job_id=? AND fence=?", result, job.JobId.ToString("D"), job.Fence); Queue("result", job.JobId, job.Fence, result, code, noIo); Event(job.JobId, job.Fence, "result_committed", now);
        });
    }
    public void ResultAcknowledged(JournalJob job, JobEnvelope response, string result, DateTimeOffset now)
    {
        Match(job, response); var expected = result == "pre_send_failed" ? "retry_wait" : result;
        if (response.State != expected) throw new BridgeFault("result_state_incompatible");
        Database.Transaction(() => { Update(job, response, "terminal"); Database.Execute("DELETE FROM outbox WHERE job_id=? AND fence=?", job.JobId.ToString("D"), job.Fence); Database.Execute("DELETE FROM contents WHERE job_id=? AND fence=?", job.JobId.ToString("D"), job.Fence); Event(job.JobId, job.Fence, "result_acknowledged", now); });
    }
    public void Revise(JournalJob job, JobEnvelope response) { Match(job, response); Update(job, response, job.LocalState); }
    public void Recover(DateTimeOffset now)
    {
        foreach (var job in Active().Where(j => j.Intent && j.Result is null)) RecordResult(job, "ambiguous", "unknown_after_send", false, now);
        foreach (var job in Active().Where(j => !j.Intent && j.LocalState == "authorized")) Database.Transaction(() => { Queue("dispatch", job.JobId, job.Fence); Database.Execute("UPDATE jobs SET local_state='authorization_pending' WHERE job_id=? AND fence=?", job.JobId.ToString("D"), job.Fence); });
    }
    public void Block(JournalJob job, bool expired)
    {
        if (job.Intent) { NeedsOperator(); return; }
        Database.Transaction(() => { Database.Execute("UPDATE jobs SET local_state=? WHERE job_id=? AND fence=?", expired ? "expired" : "blocked", job.JobId.ToString("D"), job.Fence); Database.Execute("DELETE FROM outbox WHERE job_id=? AND fence=?", job.JobId.ToString("D"), job.Fence); Database.Execute("DELETE FROM contents WHERE job_id=? AND fence=?", job.JobId.ToString("D"), job.Fence); });
    }
    public bool OperatorRequired => Database.Query("SELECT value FROM metadata WHERE key='needs_operator'").Count != 0;
    public void NeedsOperator() { Database.Transaction(() => { Database.Execute("INSERT OR REPLACE INTO metadata(key,value) VALUES('needs_operator','1')"); Database.Execute("DELETE FROM contents"); }); }
    public void Resume() => Database.Execute("DELETE FROM metadata WHERE key='needs_operator'");
    public void Purge(DateTimeOffset now)
    {
        Database.Transaction(() => { Database.Execute("DELETE FROM contents WHERE expires_at<=?", Time(now)); Database.Execute("DELETE FROM outbox WHERE job_id IN(SELECT job_id FROM jobs WHERE retain_until<=?) OR (job_id IS NULL AND created_at<=?)", Time(now), Time(now.AddDays(-180))); Database.Execute("DELETE FROM events WHERE job_id IN(SELECT job_id FROM jobs WHERE retain_until<=?) OR created_at<=?", Time(now), Time(now.AddDays(-180))); Database.Execute("DELETE FROM jobs WHERE retain_until<=?", Time(now)); Database.Execute("DELETE FROM simulator_calls WHERE created_at<=?", Time(now.AddDays(-180))); Database.Execute("DELETE FROM spooler_calls WHERE created_at<=?", Time(now.AddDays(-180))); });
        Database.Execute("PRAGMA wal_checkpoint(TRUNCATE)");
    }
    public void ClearPrivate() { Database.Execute("DELETE FROM contents WHERE is_private=1"); Database.Execute("PRAGMA wal_checkpoint(TRUNCATE)"); }
    internal byte[]? ReadProtectedContent(Guid id, long fence, bool privateData) => Database.Query("SELECT body FROM contents WHERE job_id=? AND fence=? AND is_private=?", id.ToString("D"), fence, privateData).FirstOrDefault()?[0] as byte[];
    internal byte[] AuthorizationContent(JournalJob job, DateTimeOffset now)
    {
        var current = Get(job.JobId, job.Fence); if (!current.Intent || current.Result is not null) throw new BridgeFault("dispatch_intent_required");
        var body = Database.Query("SELECT body FROM contents WHERE job_id=? AND fence=? AND is_private=1 AND expires_at>?", job.JobId.ToString("D"), job.Fence, Time(now)).FirstOrDefault()?[0] as byte[] ?? throw new BridgeFault("authorization_content_expired"); return protection.Unprotect(body);
    }
    internal void EnterSpooler(JournalJob job, Guid printer, int revision, string queue, DateTimeOffset now)
    {
        Database.Transaction(() => { var current = Get(job.JobId, job.Fence); if (!current.Intent || current.Result is not null || current.LocalState != "intent") throw new BridgeFault("dispatch_intent_required"); Database.Execute("INSERT INTO spooler_calls(job_id,fence,printer_id,printer_revision,queue_name,created_at) VALUES(?,?,?,?,?,?)", job.JobId.ToString("D"), job.Fence, printer.ToString("D"), revision, queue, Time(now)); });
    }
    internal void SpoolId(JournalJob job, int id)
    {
        if (id < 1) throw new BridgeFault("spool_identifier_invalid");
        Database.Execute("UPDATE spooler_calls SET spool_job_id=? WHERE job_id=? AND fence=? AND spool_job_id IS NULL", id, job.JobId.ToString("D"), job.Fence);
    }
    internal void SpoolObservation(JournalJob job, string observation, DateTimeOffset? submitted = null) => Database.Execute("UPDATE spooler_calls SET observation=?,submitted_at=? WHERE job_id=? AND fence=?", observation, submitted is null ? null : Time(submitted.Value), job.JobId.ToString("D"), job.Fence);
    public void Dispose() => Database.Dispose();
}
