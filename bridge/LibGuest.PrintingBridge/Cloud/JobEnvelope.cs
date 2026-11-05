using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace LibGuest.PrintingBridge.Cloud;

public sealed class JobEnvelope
{
    public required Guid JobId { get; init; }
    public required Guid AttemptId { get; init; }
    public required long Fence { get; init; }
    public required int Revision { get; init; }
    public required string Kind { get; init; }
    public required string State { get; init; }
    public required string Hash { get; init; }
    public required DateTimeOffset LeaseUntil { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }
    public required bool Received { get; init; }
    public required bool Authorized { get; init; }
    public required bool DispatchRecorded { get; init; }
    public required byte[] Content { get; init; }
    public DateTimeOffset? PrivateExpiresAt { get; init; }
    public static JobEnvelope? Parse(JsonElement value)
    {
        try
        {
            if (value.ValueKind != JsonValueKind.Object) throw new BridgeFault("envelope_invalid");
            if (value.TryGetProperty("job_id", out var id) && id.ValueKind == JsonValueKind.Null) return null;
            var allowed = new HashSet<string>(["job_id", "kind", "state", "revision", "fence", "order_id", "group_id", "sector_id", "destination_id", "copy_number", "attempt_id", "lease_until", "received", "dispatch_recorded", "dispatch_authorized", "protocol_version", "payload_version", "renderer_version", "expires_at", "snapshot", "snapshot_canonical", "snapshot_hash", "routing", "reprint", "duplicate_risk", "private", "spooler"]);
            if (value.EnumerateObject().Any(p => !allowed.Contains(p.Name)) || value.EnumerateObject().Select(p => p.Name).Distinct().Count() != value.EnumerateObject().Count()) throw new BridgeFault("envelope_invalid");
            foreach (var field in new[] { "protocol_version", "payload_version", "renderer_version" }) if (value.GetProperty(field).GetInt32() != 1) throw new BridgeFault("version_incompatible");
            var canonical = value.GetProperty("snapshot_canonical").GetString() ?? throw new BridgeFault("envelope_invalid");
            if (Encoding.UTF8.GetByteCount(canonical) > 1048576) throw new BridgeFault("payload_oversized");
            var hash = value.GetProperty("snapshot_hash").GetString() ?? "";
            if (!System.Text.RegularExpressions.Regex.IsMatch(hash, "^[0-9a-f]{64}$") || !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(canonical)), Convert.FromHexString(hash))) throw new BridgeFault("hash_invalid");
            using var document = JsonDocument.Parse(canonical, new JsonDocumentOptions { MaxDepth = 24 });
            if (!JsonElement.DeepEquals(document.RootElement, value.GetProperty("snapshot"))) throw new BridgeFault("hash_invalid");
            if (document.RootElement.GetProperty("payload_version").GetInt32() != 1 || document.RootElement.GetProperty("renderer_version").GetInt32() != 1 || document.RootElement.GetProperty("lines").ValueKind != JsonValueKind.Array) throw new BridgeFault("version_incompatible");
            var kind = value.GetProperty("kind").GetString() ?? ""; var state = value.GetProperty("state").GetString() ?? "";
            if (kind is not ("order" or "test" or "reprint") || state is not ("leased" or "dispatching" or "submitted" or "retry_wait" or "blocked" or "ambiguous" or "expired" or "cancelled")) throw new BridgeFault("envelope_invalid");
            var fence = value.GetProperty("fence").GetInt64(); var revision = value.GetProperty("revision").GetInt32(); if (fence < 1 || revision < 1) throw new BridgeFault("envelope_invalid");
            var job = value.GetProperty("job_id").GetGuid(); var attempt = value.GetProperty("attempt_id").GetGuid(); if (job == Guid.Empty || attempt == Guid.Empty) throw new BridgeFault("envelope_invalid");
            DateTimeOffset? until = null;
            if (value.TryGetProperty("private", out var privateData) && privateData.TryGetProperty("expires_at", out var expires)) until = expires.GetDateTimeOffset();
            return new JobEnvelope { JobId = job, AttemptId = attempt, Fence = fence, Revision = revision, Kind = kind, State = state, Hash = hash, LeaseUntil = value.GetProperty("lease_until").GetDateTimeOffset(), ExpiresAt = value.GetProperty("expires_at").GetDateTimeOffset(), Received = value.GetProperty("received").GetBoolean(), Authorized = value.GetProperty("dispatch_authorized").GetBoolean(), DispatchRecorded = value.GetProperty("dispatch_recorded").GetBoolean(), Content = Encoding.UTF8.GetBytes(value.GetRawText()), PrivateExpiresAt = until };
        }
        catch (BridgeFault) { throw; }
        catch { throw new BridgeFault("envelope_invalid"); }
    }
}
