namespace LibGuest.PrintingBridge;

public sealed class BridgeFault(string code) : Exception(code)
{
    public string Code { get; } = code;
}

public static class BridgeVersion
{
    public const string Current = "1.1.0";
    public const int Protocol = 1;
    public const int Payload = 1;
    public const int Renderer = 1;
}
