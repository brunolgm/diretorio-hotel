using System.Text;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Diagnostics;
using LibGuest.PrintingBridge.Storage;
using LibGuest.PrintingBridge.Printing;

namespace LibGuest.PrintingBridge;

public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        try
        {
            if (!OperatingSystem.IsWindows() || Environment.OSVersion.Version.Major < 10) throw new BridgeFault("windows_required");
            if (args.Length != 3 || args[1] != "--config" || args[0] is not ("pair" or "reprovision" or "import-credential" or "resume" or "run" or "run-once" or "service" or "diagnose")) throw new BridgeFault("command_invalid");
            var options = BridgeOptions.Load(args[2]);
            if (args[0] == "diagnose") { var native = new WindowsSpooler(); var metadata = WindowsSpooler.LocalQueues().Select(q => new { queue = q, observation = native.Observe(q) }); Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { scope = "current_windows_identity", physical_ready = (bool?)null, submissions = 0, queues = metadata })); return 0; }
            PrivateFiles.DirectoryForIdentity(options.ResolvedDataDirectory);
            using var instance = new SingleInstance(options.ResolvedDataDirectory);
            var protection = new WindowsProtection(); var vault = new CredentialVault(options.ResolvedDataDirectory, options.DeviceId, protection); var clock = new CloudClock();
            using var client = new CloudClient(options, vault, clock); var log = new BoundedLog(Path.Combine(options.ResolvedDataDirectory, "logs"));
            using var cancel = new CancellationTokenSource(); Console.CancelKeyPress += (_, e) => { e.Cancel = true; cancel.Cancel(); };
            if (args[0] is "pair" or "reprovision") { await client.Pair(ReadSecret(), args[0] == "reprovision", cancel.Token); if (args[0] == "reprovision") { using var recovered = new Journal(options.ResolvedDataDirectory, options.DeviceId, protection); recovered.Resume(); } log.Write(EventCode.Paired); Console.WriteLine("{\"status\":\"paired\"}"); return 0; }
            if (args[0] == "import-credential") { await client.ImportCredential(ReadSecret(), cancel.Token); using var state = new Journal(options.ResolvedDataDirectory, options.DeviceId, protection); state.Resume(); log.Write(EventCode.CredentialUpdated); Console.WriteLine("{\"status\":\"credential_updated\"}"); return 0; }
            using var journal = new Journal(options.ResolvedDataDirectory, options.DeviceId, protection);
            if (args[0] == "resume") { await client.Heartbeat(cancel.Token); journal.Resume(); Console.WriteLine("{\"status\":\"resumed\"}"); return 0; }
            async Task Run(CancellationToken token) { log.Write(EventCode.Starting); try { await new BridgeWorker(options, journal, client, clock, log).Run(args[0] == "run-once", token); } finally { log.Write(EventCode.Stopped); } }
            if (args[0] == "service") WindowsService.Run(Run); else await Run(cancel.Token);
            return 0;
        }
        catch (OperationCanceledException) { return 0; }
        catch (BridgeFault e) { Console.Error.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { event_code = "bridge_blocked", error_code = e.Code })); return 20; }
        catch { Console.Error.WriteLine("{\"event_code\":\"bridge_blocked\",\"error_code\":\"unexpected_failure\"}"); return 21; }
    }
    private static string ReadSecret()
    {
        if (Console.IsInputRedirected) { var line = Console.ReadLine(); if (!CredentialVault.IsValidToken(line)) throw new BridgeFault("secret_input_invalid"); return line!; }
        Console.Error.Write("Código/credencial (entrada oculta): "); var builder = new StringBuilder();
        while (true) { var key = Console.ReadKey(true); if (key.Key == ConsoleKey.Enter) break; if (key.Key == ConsoleKey.Backspace) { if (builder.Length > 0) builder.Length--; } else if (!char.IsControl(key.KeyChar) && builder.Length < 81) builder.Append(key.KeyChar); }
        Console.Error.WriteLine(); var value = builder.ToString(); if (!CredentialVault.IsValidToken(value)) throw new BridgeFault("secret_input_invalid"); return value;
    }
}
