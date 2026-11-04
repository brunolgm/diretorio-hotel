using System.Runtime.InteropServices;
using System.Text;

namespace LibGuest.PrintingBridge.Storage;

/// <summary>Thin parameterized binding to SQLite supplied and serviced by Windows, not a bundled printer/provider package.</summary>
public sealed class SqliteDatabase : IDisposable
{
    private IntPtr handle;
    private readonly object gate = new();
    private const string Library = "winsqlite3.dll";
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_open_v2(byte[] name, out IntPtr db, int flags, IntPtr vfs);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_close_v2(IntPtr db);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_busy_timeout(IntPtr db, int ms);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_prepare_v2(IntPtr db, byte[] sql, int bytes, out IntPtr statement, IntPtr tail);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_step(IntPtr statement);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_finalize(IntPtr statement);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_bind_null(IntPtr s, int index);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_bind_int64(IntPtr s, int index, long value);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_bind_text(IntPtr s, int index, byte[] value, int length, IntPtr destructor);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_bind_blob(IntPtr s, int index, byte[] value, int length, IntPtr destructor);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_column_count(IntPtr s);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_column_type(IntPtr s, int column);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern IntPtr sqlite3_column_text(IntPtr s, int column);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern IntPtr sqlite3_column_blob(IntPtr s, int column);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern int sqlite3_column_bytes(IntPtr s, int column);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern long sqlite3_column_int64(IntPtr s, int column);
    [DllImport(Library, CallingConvention = CallingConvention.Cdecl)] private static extern IntPtr sqlite3_libversion();
    public static string Version => Marshal.PtrToStringUTF8(sqlite3_libversion()) ?? "unknown";
    public SqliteDatabase(string path)
    {
        try
        {
            Check(sqlite3_open_v2(Utf8(path), out handle, 2 | 4 | 0x10000, IntPtr.Zero));
            Check(sqlite3_busy_timeout(handle, 3000));
            Execute("PRAGMA journal_mode=WAL"); Execute("PRAGMA synchronous=FULL"); Execute("PRAGMA foreign_keys=ON");
            Execute("PRAGMA secure_delete=ON"); Execute("PRAGMA temp_store=MEMORY"); Execute("PRAGMA trusted_schema=OFF");
        }
        catch { Dispose(); throw new BridgeFault("journal_open_failed"); }
    }
    private static byte[] Utf8(string s) => Encoding.UTF8.GetBytes(s + '\0');
    private static void Check(int code) { if (code != 0) throw new BridgeFault(code is 5 or 6 ? "journal_busy" : "journal_invalid"); }
    public IReadOnlyList<object?[]> Query(string sql, params object?[] values)
    {
        lock (gate)
        {
            Check(sqlite3_prepare_v2(handle, Utf8(sql), -1, out var statement, IntPtr.Zero));
            try
            {
                for (var i = 0; i < values.Length; i++)
                {
                    var value = values[i];
                    var code = value switch
                    {
                        null => sqlite3_bind_null(statement, i + 1),
                        int n => sqlite3_bind_int64(statement, i + 1, n),
                        long n => sqlite3_bind_int64(statement, i + 1, n),
                        bool b => sqlite3_bind_int64(statement, i + 1, b ? 1 : 0),
                        byte[] b => sqlite3_bind_blob(statement, i + 1, b, b.Length, new IntPtr(-1)),
                        string s => BindString(statement, i + 1, s),
                        _ => throw new BridgeFault("journal_binding_invalid")
                    };
                    Check(code);
                }
                var rows = new List<object?[]>(); int result;
                while ((result = sqlite3_step(statement)) == 100)
                {
                    var row = new object?[sqlite3_column_count(statement)];
                    for (var i = 0; i < row.Length; i++)
                    {
                        row[i] = sqlite3_column_type(statement, i) switch
                        {
                            1 => sqlite3_column_int64(statement, i),
                            3 => Marshal.PtrToStringUTF8(sqlite3_column_text(statement, i)),
                            4 => Blob(statement, i),
                            5 => null,
                            _ => throw new BridgeFault("journal_type_invalid")
                        };
                    }
                    rows.Add(row);
                }
                if (result != 101) Check(result); return rows;
            }
            finally { sqlite3_finalize(statement); }
        }
    }
    private static int BindString(IntPtr s, int index, string value) { var bytes = Encoding.UTF8.GetBytes(value); return sqlite3_bind_text(s, index, bytes, bytes.Length, new IntPtr(-1)); }
    private static byte[] Blob(IntPtr s, int column) { var data = new byte[sqlite3_column_bytes(s, column)]; Marshal.Copy(sqlite3_column_blob(s, column), data, 0, data.Length); return data; }
    public void Execute(string sql, params object?[] values) => Query(sql, values);
    public void Transaction(Action action)
    {
        lock (gate) { Execute("BEGIN IMMEDIATE"); try { action(); Execute("COMMIT"); } catch { Execute("ROLLBACK"); throw; } }
    }
    public void Dispose() { lock (gate) { if (handle != IntPtr.Zero) { sqlite3_close_v2(handle); handle = IntPtr.Zero; } } }
}
