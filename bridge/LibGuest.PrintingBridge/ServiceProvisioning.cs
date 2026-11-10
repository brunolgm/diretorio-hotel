using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.Json;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge;

/// <summary>Local administrative provisioning/status IPC. Never a network listener or print endpoint.</summary>
internal static class ServiceProvisioning
{
    private const string ServiceName = "LibGuestPrintingBridge";
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetNamedPipeServerProcessId(Microsoft.Win32.SafeHandles.SafePipeHandle pipe, out uint process);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr OpenSCManagerW(string? machine, string? database, uint access);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr OpenServiceW(IntPtr manager, string name, uint access);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryServiceStatusEx(IntPtr service, int level, IntPtr buffer, int bytes, out int needed);
    [DllImport("advapi32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CloseServiceHandle(IntPtr handle);
    private static string PipeName(BridgeOptions options) => "LibGuest.PrintingBridge." + options.DeviceId.ToString("N");
    private static NamedPipeServerStream Server(BridgeOptions options)
    {
        var security = new PipeSecurity(); security.SetAccessRuleProtection(true, false);
        security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(WellKnownSidType.NetworkSid, null), PipeAccessRights.FullControl, AccessControlType.Deny));
        foreach (var sid in new[] { WindowsIdentity.GetCurrent().User!, new SecurityIdentifier(WellKnownSidType.LocalSystemSid, null), new SecurityIdentifier(WellKnownSidType.BuiltinAdministratorsSid, null) }) security.AddAccessRule(new PipeAccessRule(sid, PipeAccessRights.FullControl, AccessControlType.Allow));
        return NamedPipeServerStreamAcl.Create(PipeName(options), PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 4096, 4096, security);
    }
    private static async Task<byte[]> Read(Stream pipe, int maximum, CancellationToken token)
    {
        var length = new byte[4]; await pipe.ReadExactlyAsync(length, token); var size = BitConverter.ToInt32(length);
        if (size < 1 || size > maximum) throw new BridgeFault("provision_packet_invalid");
        var body = new byte[size]; await pipe.ReadExactlyAsync(body, token); return body;
    }
    private static async Task Write(Stream pipe, byte[] bytes, CancellationToken token)
    { await pipe.WriteAsync(BitConverter.GetBytes(bytes.Length), token); await pipe.WriteAsync(bytes, token); await pipe.FlushAsync(token); }
    public static async Task ServePair(BridgeOptions options, CloudClient client, CancellationToken cancellation)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation); timeout.CancelAfter(TimeSpan.FromMinutes(5));
        using var pipe = Server(options); await pipe.WaitForConnectionAsync(timeout.Token); var secret = await Read(pipe, 81, timeout.Token);
        try
        {
            await client.Pair(Encoding.UTF8.GetString(secret), false, timeout.Token);
            await Write(pipe, JsonSerializer.SerializeToUtf8Bytes(new { status = "paired", identity = WindowsIdentity.GetCurrent().User!.Value, dpapi = "CurrentUser", device_id = options.DeviceId }), timeout.Token);
        }
        finally { CryptographicOperations.ZeroMemory(secret); }
    }
    public static async Task ServeStatus(BridgeOptions options, Journal journal, CancellationToken cancellation, bool maintenance = false, CloudClient? client = null, CloudClock? clock = null)
    {
        while (!cancellation.IsCancellationRequested)
        {
            using var pipe = Server(options); await pipe.WaitForConnectionAsync(cancellation);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation); timeout.CancelAfter(TimeSpan.FromSeconds(5));
            try
            {
                var command = Encoding.UTF8.GetString(await Read(pipe, 16, timeout.Token));
                if (command == "resume")
                {
                    if (!maintenance || client is null || clock is null) { await Write(pipe, JsonSerializer.SerializeToUtf8Bytes(new { status = "blocked", error_code = "maintenance_required" }), timeout.Token); continue; }
                    timeout.CancelAfter(TimeSpan.FromSeconds(50));
                    try { await MaintenanceRecovery.Resume(journal, client, clock, timeout.Token); await Write(pipe, JsonSerializer.SerializeToUtf8Bytes(new { status = "resumed", worker_started = false }), timeout.Token); }
                    catch (BridgeFault fault) { await Write(pipe, JsonSerializer.SerializeToUtf8Bytes(new { status = "blocked", error_code = System.Text.RegularExpressions.Regex.IsMatch(fault.Code, "^[a-z0-9_]{1,60}$") ? fault.Code : "recovery_failed" }), timeout.Token); }
                    continue;
                }
                if (command != "status") continue;
                var jobs = journal.Database.Query("SELECT job_id,fence,kind,cloud_state,local_state,intent,result FROM jobs ORDER BY first_seen DESC LIMIT 50").Select(r => new { job_id = r[0], fence = r[1], kind = r[2], cloud_state = r[3], local_state = r[4], intent = r[5], result = r[6] }).ToArray();
                var submissions = journal.Database.Query("SELECT job_id,fence,printer_id,printer_revision,queue_name,spool_job_id,observation FROM spooler_calls ORDER BY created_at DESC LIMIT 50").Select(r => new { job_id = r[0], fence = r[1], printer_id = r[2], printer_revision = r[3], queue = r[4], spool_job_id = r[5], observation = r[6] }).ToArray();
                var credentialReadable = false; try { _ = new CredentialVault(options.ResolvedDataDirectory, options.DeviceId, new WindowsProtection()).Load(); credentialReadable = true; } catch (BridgeFault) { }
                await Write(pipe, JsonSerializer.SerializeToUtf8Bytes(new { status = maintenance ? "maintenance" : "running", device_id = options.DeviceId, identity = WindowsIdentity.GetCurrent().User!.Value, dpapi = "CurrentUser", credential_readable = credentialReadable, version = BridgeVersion.Current, operator_required = journal.OperatorRequired, pending = journal.Pending().Count, jobs, submissions, diagnostics = maintenance ? MaintenanceDiagnostics.Read(options.ResolvedDataDirectory) : [] }), timeout.Token);
            }
            catch (OperationCanceledException) when (!cancellation.IsCancellationRequested) { }
            catch (IOException) { }
            catch (BridgeFault) { }
        }
    }
    private static uint ServiceProcess()
    {
        var manager = OpenSCManagerW(null, null, 1); if (manager == IntPtr.Zero) throw new BridgeFault("service_identity_unverified");
        try
        {
            var service = OpenServiceW(manager, ServiceName, 4); if (service == IntPtr.Zero) throw new BridgeFault("service_identity_unverified");
            try
            {
                var buffer = Marshal.AllocHGlobal(64);
                try { if (!QueryServiceStatusEx(service, 0, buffer, 64, out _) || Marshal.ReadInt32(buffer, 4) != 4) throw new BridgeFault("service_identity_unverified"); return unchecked((uint)Marshal.ReadInt32(buffer, 28)); }
                finally { Marshal.FreeHGlobal(buffer); }
            }
            finally { CloseServiceHandle(service); }
        }
        finally { CloseServiceHandle(manager); }
    }
    public static async Task<string> Client(BridgeOptions options, string? pairingSecret, CancellationToken cancellation, string command = "status")
    {
        using var pipe = new NamedPipeClientStream(".", PipeName(options), PipeDirection.InOut, PipeOptions.Asynchronous, TokenImpersonationLevel.Identification);
        await pipe.ConnectAsync(30000, cancellation);
        if (!GetNamedPipeServerProcessId(pipe.SafePipeHandle, out var actual) || actual == 0 || actual != ServiceProcess()) throw new BridgeFault("service_identity_unverified");
        if (command is not ("status" or "resume") || pairingSecret is not null && command != "status") throw new BridgeFault("provision_packet_invalid");
        var bytes = Encoding.UTF8.GetBytes(pairingSecret ?? command);
        try { await Write(pipe, bytes, cancellation); return Encoding.UTF8.GetString(await Read(pipe, 65536, cancellation)); }
        finally { CryptographicOperations.ZeroMemory(bytes); }
    }
}
