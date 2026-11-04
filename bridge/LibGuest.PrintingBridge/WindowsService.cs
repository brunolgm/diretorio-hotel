using System.Runtime.InteropServices;

namespace LibGuest.PrintingBridge;

/// <summary>Native SCM lifetime; no registration, installer, interactive window or inbound listener.</summary>
internal static class WindowsService
{
    private delegate void ServiceMain(int count, IntPtr arguments);
    private delegate void Handler(int control);
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct Entry { public string? Name; public ServiceMain? Main; }
    [StructLayout(LayoutKind.Sequential)] private struct Status { public int Type, State, Accepted, Win32Exit, ServiceExit, Checkpoint, WaitHint; }
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool StartServiceCtrlDispatcherW([In] Entry[] table);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr RegisterServiceCtrlHandlerW(string name, Handler handler);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetServiceStatus(IntPtr handle, ref Status status);
    private static readonly Handler Control = Handle;
    private static readonly ServiceMain Main = Execute;
    private static Func<CancellationToken, Task>? worker;
    private static CancellationTokenSource? stopping;
    private static IntPtr statusHandle;
    private static Status status;
    public static void Run(Func<CancellationToken, Task> run)
    {
        worker = run;
        if (!StartServiceCtrlDispatcherW([new Entry { Name = "LibGuestPrintingBridge", Main = Main }, new Entry()])) throw new BridgeFault("service_dispatcher_unavailable");
    }
    private static void Handle(int control)
    {
        if (control is 1 or 5) { status.State = 3; status.WaitHint = 15000; SetServiceStatus(statusHandle, ref status); stopping?.Cancel(); }
    }
    private static void Execute(int count, IntPtr arguments)
    {
        statusHandle = RegisterServiceCtrlHandlerW("LibGuestPrintingBridge", Control); if (statusHandle == IntPtr.Zero) return;
        stopping = new CancellationTokenSource(); status = new Status { Type = 0x10, State = 2, WaitHint = 15000 }; SetServiceStatus(statusHandle, ref status);
        try { status.State = 4; status.Accepted = 1 | 4; status.WaitHint = 0; SetServiceStatus(statusHandle, ref status); worker!(stopping.Token).GetAwaiter().GetResult(); }
        catch { status.Win32Exit = 1066; status.ServiceExit = 1; }
        finally { status.State = 1; status.Accepted = 0; SetServiceStatus(statusHandle, ref status); stopping.Dispose(); }
    }
}
