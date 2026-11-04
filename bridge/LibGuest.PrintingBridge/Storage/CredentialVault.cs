using System.Security.Cryptography;
using System.Text.Json;

namespace LibGuest.PrintingBridge.Storage;

public sealed class CredentialVault(string directory, Guid device, IProtection protection)
{
    private string PathName => Path.Combine(directory, "credential.dpapi");
    private sealed class ProtectedCredential { public Guid Device { get; set; } public string Token { get; set; } = ""; }
    public static bool IsValidToken(string? token)
    {
        if (token is null || token.Length != 80 || token[36] != '.' || !Guid.TryParseExact(token[..36], "D", out var id) || id == Guid.Empty || !System.Text.RegularExpressions.Regex.IsMatch(token[37..], "^[A-Za-z0-9_-]{43}$")) return false;
        try { var bytes = Convert.FromBase64String(token[37..].Replace('-', '+').Replace('_', '/') + "="); return bytes.Length == 32 && Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_') == token[37..]; } catch { return false; }
    }
    public void Save(string token)
    {
        if (!IsValidToken(token)) throw new BridgeFault("credential_invalid");
        var plain = JsonSerializer.SerializeToUtf8Bytes(new ProtectedCredential { Device = device, Token = token });
        try { PrivateFiles.WriteAtomic(PathName, protection.Protect(plain)); }
        finally { CryptographicOperations.ZeroMemory(plain); }
    }
    public string Load()
    {
        byte[]? plain = null;
        try
        {
            var bytes = File.ReadAllBytes(PathName); if (bytes.Length > 16384) throw new BridgeFault("credential_unreadable");
            plain = protection.Unprotect(bytes); var value = JsonSerializer.Deserialize<ProtectedCredential>(plain);
            if (value?.Device != device || !IsValidToken(value.Token)) throw new BridgeFault("credential_unreadable"); return value.Token;
        }
        catch { throw new BridgeFault("credential_unreadable"); }
        finally { if (plain is not null) CryptographicOperations.ZeroMemory(plain); }
    }
}
