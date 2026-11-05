using System.Text.Json;
using LibGuest.PrintingBridge.Cloud;
using LibGuest.PrintingBridge.Printing;
using LibGuest.PrintingBridge.Storage;

namespace LibGuest.PrintingBridge.Tests;

internal static partial class Program
{
    private static async Task DiscoveryTests()
    {
        using var wire = JsonDocument.Parse(JsonSerializer.Serialize(new DiscoveredQueue("Queue fixture", "Driver fixture", "unknown")));
        Check(wire.RootElement.EnumerateObject().Select(p => p.Name).Order().SequenceEqual(new[] { "driver", "name", "state" }), "discovery wire metadata matches closed lowercase Cloud schema");
        var dir = DirectoryName(); var device = Guid.NewGuid(); var vault = new CredentialVault(dir, device, new WindowsProtection());
        var credential = Token(); vault.Save(credential); var expected = credential; var discoveries = 0; var refresh = false;
        var options = new BridgeOptions { DeviceId = device, CloudBaseUrl = "https://localhost:4318/", DataDirectory = dir, Environment = "laboratory", QueueDiscoveryEnabled = true };
        using var client = new CloudClient(options, vault, new CloudClock(), new Handler(request =>
        {
            Check(request.Headers.Authorization?.Parameter == expected, "discovery and heartbeat use the same scoped credential including replacement");
            if (request.RequestUri!.AbsolutePath.EndsWith("/heartbeat")) return Json(new { device_id = device, server_time = DateTimeOffset.UtcNow, compatible = true, printer_ready = (bool?)null, discovery_requested = refresh });
            Check(request.RequestUri.AbsolutePath == "/api/fb/printing/spooler/discovery", "discovery uses normal authenticated HTTPS boundary");
            using var body = JsonDocument.Parse(request.Content!.ReadAsStringAsync().GetAwaiter().GetResult());
            Check(body.RootElement.GetProperty("queues").EnumerateArray().All(q => q.EnumerateObject().Select(p => p.Name).Order().SequenceEqual(new[] { "driver", "name", "state" })), "actual Windows discovery packet contains technical fields only");
            discoveries++; return Json(new { device_id = device, physical_ready = (bool?)null });
        }));
        await client.Heartbeat(CancellationToken.None); Check(discoveries == 1, "first heartbeat discovers queues without physical submission");
        await client.Heartbeat(CancellationToken.None); Check(discoveries == 1, "ordinary heartbeat does not enumerate queues again before refresh interval");
        refresh = true; await client.Heartbeat(CancellationToken.None); Check(discoveries == 2, "authorized Admin refresh requests immediate discovery");
        expected = Token(); await client.ImportCredential(expected, CancellationToken.None); Check(vault.Load() == expected && discoveries == 3, "credential replacement validates discovery before committing protected replacement");
    }
}
