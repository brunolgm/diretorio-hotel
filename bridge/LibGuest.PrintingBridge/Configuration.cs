using System.Text.Json;
using System.Text.Json.Serialization;

namespace LibGuest.PrintingBridge;

public sealed class BridgeOptions
{
    public string CloudBaseUrl { get; init; } = "";
    public Guid DeviceId { get; init; }
    public string Environment { get; init; } = "production";
    public string? DataDirectory { get; init; }
    public string? LaboratoryCertificateSha256 { get; init; }
    public bool SimulatorEnabled { get; init; }
    public bool WindowsSpoolerEnabled { get; init; }
    public bool QueueDiscoveryEnabled { get; init; }
    public bool LaboratorySpooler { get; init; }
    public string LaboratorySpoolerScenario { get; init; } = "success";
    [JsonIgnore] public bool AdapterEnabled => SimulatorEnabled || WindowsSpoolerEnabled;
    public string SimulatorScenario { get; init; } = "success";
    public int SimulatorDelayMilliseconds { get; init; } = 50;
    public string? LaboratoryCheckpoint { get; init; }
    public int ActivePollSeconds { get; init; } = 5;
    public int IdlePollSeconds { get; init; } = 20;
    public int HeartbeatSeconds { get; init; } = 15;
    public int HttpTimeoutSeconds { get; init; } = 15;
    public int MaximumBackoffSeconds { get; init; } = 300;
    [JsonIgnore] public bool IsLaboratory => Environment == "laboratory";
    [JsonIgnore] public string SoftwareVersion => IsLaboratory ? "c2-lab-" + BridgeVersion.Current : "c2-" + BridgeVersion.Current;
    [JsonIgnore] public Uri CloudUri => new(CloudBaseUrl, UriKind.Absolute);
    [JsonIgnore] public string ResolvedDataDirectory => Path.GetFullPath(DataDirectory ?? Path.Combine(System.Environment.GetFolderPath(System.Environment.SpecialFolder.CommonApplicationData), "LibGuest", "PrintingBridge", DeviceId.ToString("D")));
    public static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow, MaxDepth = 32 };
    public static BridgeOptions Load(string path)
    {
        try
        {
            var bytes = File.ReadAllBytes(path); if (bytes.Length > 8192) throw new BridgeFault("configuration_invalid");
            var payload = bytes.AsSpan(); if (payload.StartsWith(new byte[] { 0xef, 0xbb, 0xbf })) payload = payload[3..];
            var options = JsonSerializer.Deserialize<BridgeOptions>(payload, Json) ?? throw new BridgeFault("configuration_invalid"); options.Validate(); return options;
        }
        catch (BridgeFault) { throw; }
        catch { throw new BridgeFault("configuration_invalid"); }
    }
    public void Validate()
    {
        if (SimulatorEnabled && WindowsSpoolerEnabled || LaboratorySpooler && (!IsLaboratory || !WindowsSpoolerEnabled) || !IsLaboratory && LaboratorySpoolerScenario != "success" || LaboratorySpoolerScenario is not ("success" or "offline" or "missing_queue" or "paper_out" or "ambiguous" or "no_response" or "delay")) throw new BridgeFault("configuration_invalid");
        if (DeviceId == Guid.Empty || !Uri.TryCreate(CloudBaseUrl, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.UserInfo.Length != 0 || uri.Query.Length != 0 || uri.Fragment.Length != 0 || uri.AbsolutePath != "/") throw new BridgeFault("configuration_invalid");
        if (Environment is not ("laboratory" or "production") || ActivePollSeconds is < 1 or > 30 || IdlePollSeconds is < 15 or > 60 || HeartbeatSeconds is < 5 or > 60 || HttpTimeoutSeconds is < 1 or > 30 || MaximumBackoffSeconds is < 5 or > 300 || SimulatorDelayMilliseconds is < 0 or > 30000) throw new BridgeFault("configuration_invalid");
        if (SimulatorScenario is not ("success" or "safe_failure" or "ambiguous" or "delay" or "no_response")) throw new BridgeFault("configuration_invalid");
        if (!IsLaboratory && (SimulatorEnabled || LaboratoryCheckpoint is not null || LaboratoryCertificateSha256 is not null || SimulatorScenario != "success")) throw new BridgeFault("laboratory_required");
        if (LaboratoryCertificateSha256 is not null && (!IsLaboratory || !uri.IsLoopback || !System.Text.RegularExpressions.Regex.IsMatch(LaboratoryCertificateSha256, "^[0-9a-fA-F]{64}$"))) throw new BridgeFault("configuration_invalid");
        if (LaboratoryCheckpoint is not null && !LabCheckpoints.Stages.Contains(LaboratoryCheckpoint)) throw new BridgeFault("configuration_invalid");
        if (DataDirectory is not null && !Path.IsPathFullyQualified(DataDirectory)) throw new BridgeFault("configuration_invalid");
        if (!IsLaboratory)
        {
            var root = Path.GetFullPath(Path.Combine(System.Environment.GetFolderPath(System.Environment.SpecialFolder.CommonApplicationData), "LibGuest", "PrintingBridge")) + Path.DirectorySeparatorChar;
            if (!ResolvedDataDirectory.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new BridgeFault("data_directory_invalid");
        }
    }
}
