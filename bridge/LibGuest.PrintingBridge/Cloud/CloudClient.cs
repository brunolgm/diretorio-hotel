using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text.Json;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge.Cloud;

public sealed class CloudClient : IDisposable
{
    private readonly HttpClient http;
    private readonly BridgeOptions options;
    private readonly CredentialVault vault;
    private readonly CloudClock clock;
    public CloudClient(BridgeOptions options, CredentialVault vault, CloudClock clock, HttpMessageHandler? laboratoryHandler = null)
    {
        this.options = options; this.vault = vault; this.clock = clock; options.Validate();
        if (laboratoryHandler is not null && !options.IsLaboratory) throw new BridgeFault("laboratory_required");
        var handler = new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false, UseProxy = false, AutomaticDecompression = DecompressionMethods.None, MaxConnectionsPerServer = 2 };
        if (options.LaboratoryCertificateSha256 is not null)
        {
            var expected = Convert.FromHexString(options.LaboratoryCertificateSha256);
            handler.ServerCertificateCustomValidationCallback = (_, certificate, _, errors) =>
            {
                if (certificate is null || (errors & (SslPolicyErrors.RemoteCertificateNameMismatch | SslPolicyErrors.RemoteCertificateNotAvailable)) != 0 || !CryptographicOperations.FixedTimeEquals(SHA256.HashData(certificate.RawData), expected)) return false;
                using var chain = new X509Chain(); chain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust; chain.ChainPolicy.CustomTrustStore.Add(certificate); chain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;
                return chain.Build(certificate);
            };
        }
        http = new HttpClient(laboratoryHandler ?? handler) { Timeout = TimeSpan.FromSeconds(options.HttpTimeoutSeconds) };
        if (laboratoryHandler is not null) handler.Dispose();
    }
    private async Task<JsonDocument> Send(string operation, object body, CancellationToken cancellation, string? credentialOverride = null)
    {
        if (operation is not ("exchange" or "heartbeat" or "claim" or "receipt" or "dispatch" or "result")) throw new BridgeFault("operation_invalid");
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(options.CloudUri, "api/fb/printing/device/" + operation));
        request.Content = new ByteArrayContent(JsonSerializer.SerializeToUtf8Bytes(body)); request.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        if (operation != "exchange") request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", credentialOverride ?? vault.Load());
        try
        {
            using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellation);
            if (!response.IsSuccessStatusCode) throw new BridgeFault("cloud_" + (int)response.StatusCode);
            if (response.Content.Headers.ContentType?.MediaType != "application/json") throw new BridgeFault("response_invalid");
            const int maximum = 4 * 1024 * 1024;
            if (response.Content.Headers.ContentLength > maximum) throw new BridgeFault("response_oversized");
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation); timeout.CancelAfter(TimeSpan.FromSeconds(options.HttpTimeoutSeconds));
            await using var input = await response.Content.ReadAsStreamAsync(timeout.Token); using var output = new MemoryStream(); var buffer = new byte[8192]; int count;
            while ((count = await input.ReadAsync(buffer, timeout.Token)) != 0) { if (output.Length + count > maximum) throw new BridgeFault("response_oversized"); output.Write(buffer, 0, count); }
            return JsonDocument.Parse(output.ToArray(), new JsonDocumentOptions { MaxDepth = 32 });
        }
        catch (BridgeFault) { throw; }
        catch (OperationCanceledException) when (!cancellation.IsCancellationRequested) { throw new BridgeFault("cloud_timeout"); }
        catch (HttpRequestException) { throw new BridgeFault("cloud_offline"); }
        catch (IOException) { throw new BridgeFault("cloud_offline"); }
        catch (JsonException) { throw new BridgeFault("response_invalid"); }
    }
    public async Task Pair(string pairingCode, bool replace, CancellationToken cancellation)
    {
        if (!CredentialVault.IsValidToken(pairingCode)) throw new BridgeFault("pairing_invalid");
        if (!replace && File.Exists(Path.Combine(options.ResolvedDataDirectory, "credential.dpapi"))) throw new BridgeFault("reprovision_required");
        using var response = await Send("exchange", new { protocol_version = 1, pairing_token = pairingCode, device_id = options.DeviceId, software_version = options.SoftwareVersion }, cancellation);
        try
        {
            var value = response.RootElement; var credential = value.GetProperty("credential").GetString() ?? "";
            if (value.GetProperty("device_id").GetGuid() != options.DeviceId || value.GetProperty("protocol_version").GetInt32() != 1 || !CredentialVault.IsValidToken(credential) || value.GetProperty("credential_id").GetGuid() != Guid.Parse(credential[..36])) throw new BridgeFault("pairing_response_invalid");
            vault.Save(credential);
        }
        catch (BridgeFault) { throw; }
        catch { throw new BridgeFault("pairing_response_invalid"); }
    }
    public async Task Heartbeat(CancellationToken cancellation, string? credentialOverride = null)
    {
        var start = Stopwatch.GetTimestamp();
        using var response = await Send("heartbeat", new { protocol_version = 1, software_version = options.SoftwareVersion, observed_state = options.SimulatorEnabled ? "online" : "degraded" }, cancellation, credentialOverride);
        try
        {
            var value = response.RootElement;
            if (value.GetProperty("device_id").GetGuid() != options.DeviceId || !value.GetProperty("compatible").GetBoolean() || value.GetProperty("printer_ready").ValueKind != JsonValueKind.Null) throw new BridgeFault("heartbeat_incompatible");
            clock.Synchronize(value.GetProperty("server_time").GetDateTimeOffset() + Stopwatch.GetElapsedTime(start));
        }
        catch (BridgeFault) { throw; }
        catch { throw new BridgeFault("heartbeat_incompatible"); }
    }
    public async Task ImportCredential(string credential, CancellationToken cancellation)
    {
        if (!CredentialVault.IsValidToken(credential)) throw new BridgeFault("credential_invalid");
        await Heartbeat(cancellation, credential); vault.Save(credential);
    }
    public async Task<JobEnvelope?> Claim(Guid key, CancellationToken cancellation)
    {
        using var response = await Send("claim", new { protocol_version = 1, key }, cancellation); return JobEnvelope.Parse(response.RootElement);
    }
    public async Task<JobEnvelope> Receipt(JournalJob job, CancellationToken cancellation)
    {
        using var response = await Send("receipt", new { protocol_version = 1, job_id = job.JobId, fence = job.Fence, revision = job.Revision, snapshot_hash = job.Hash }, cancellation); return JobEnvelope.Parse(response.RootElement) ?? throw new BridgeFault("envelope_invalid");
    }
    public async Task<JobEnvelope> Dispatch(JournalJob job, CancellationToken cancellation)
    {
        using var response = await Send("dispatch", new { protocol_version = 1, job_id = job.JobId, fence = job.Fence, revision = job.Revision, snapshot_hash = job.Hash }, cancellation); return JobEnvelope.Parse(response.RootElement) ?? throw new BridgeFault("envelope_invalid");
    }
    public async Task<JobEnvelope> Result(JournalJob job, PendingOperation operation, CancellationToken cancellation)
    {
        using var response = await Send("result", new { protocol_version = 1, job_id = job.JobId, fence = job.Fence, revision = job.Revision, key = operation.Key, result = operation.Result, code = operation.Code, no_io = operation.NoIo }, cancellation); return JobEnvelope.Parse(response.RootElement) ?? throw new BridgeFault("envelope_invalid");
    }
    public void Dispose() => http.Dispose();
}
