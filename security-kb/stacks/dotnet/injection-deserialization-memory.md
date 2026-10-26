# .NET: injection, deserialization, memory

Companion to `core/injection-deserialization-memory.md`. Microsoft Learn facts checked October 2026.

## SQL ([SQL queries](https://learn.microsoft.com/ef/core/querying/sql-queries))
- `FromSql` and `FromSqlInterpolated` are safe: interpolated values become separate `DbParameter` values. `FromSqlRaw` and `ExecuteSqlRaw` take plain text and are vulnerable if you concatenate or interpolate untrusted values into it. `ExecuteSql` is the safe counterpart for non-query commands.
- Column and table names cannot be parameters; map them from an allow-list.
- EF 10 adds an analyzer that warns when concatenation occurs in a raw SQL method ([EF Core 10](https://learn.microsoft.com/ef/core/what-is-new/ef-core-10.0/whatsnew)). Do not suppress it without a note saying why the fragment is trusted.
- Analyzer CA2100 flags command text built from string arguments with ADO.NET. Use `SqlParameter` values.
- Search patterns: `FromSqlRaw(`, `ExecuteSqlRaw(`, `SqlCommand` with `+` or `$"` in `CommandText`, Dapper calls with interpolated SQL strings.
- The hook rule `raw-sql-interpolation` flags the most common form of this.

## Deserialization ([BinaryFormatter security guide](https://learn.microsoft.com/dotnet/standard/serialization/binaryformatter-security-guide))
- `BinaryFormatter` cannot be made secure. From .NET 9 its implementation throws `PlatformNotSupportedException`. The same risk applies to `SoapFormatter`, `NetDataContractSerializer`, `LosFormatter`, and `ObjectStateFormatter`.
- A reference to the unsupported compatibility package `System.Runtime.Serialization.Formatters`, which restores the throwing implementation, is a finding.
- JSON: use `System.Text.Json` with concrete types. In Newtonsoft.Json avoid `TypeNameHandling` other than `None` for untrusted input. Be careful with polymorphic deserialization.
- XML: use `XmlReader` with DTD processing prohibited and no external resolver for untrusted input.

## Other .NET specifics
- Process execution: `ProcessStartInfo` with `ArgumentList` (not a single `Arguments` string), `UseShellExecute = false`, and an allow-listed `FileName`.
- Paths: `Path.GetFullPath(Path.Combine(root, name))`, then check it starts with the root plus a directory separator. Beware of `Path.Combine` discarding earlier segments when a later one is rooted.
- Razor encodes by default. Search for `Html.Raw`, `MarkupString`, and string-built HTML in Blazor.

## Memory safety in .NET ([unsafe code best practices](https://learn.microsoft.com/dotnet/standard/unsafe-code/best-practices))
- Safe managed code is bounds-checked. Look for the `unsafe` keyword, `fixed`, `stackalloc`, `Marshal.*`, `Unsafe.*`, `NativeMemory`, `[DllImport]`/`[LibraryImport]`, COM interop, and native NuGet dependencies (`runtimes/*/native`). If none exist, there is little binary-level surface.
- Learn's guidance includes: do not mutate strings through pointers, validate sizes before copying, and keep unsafe regions small and tested.
- For interop, check buffer sizes passed to native functions, struct layout, string marshalling, pinned-memory lifetime, and who frees what.

## Leaks and secrets in memory
- Undisposed `IDisposable` (connections, streams), `HttpClient` created per call (use `IHttpClientFactory`), event handlers never unsubscribed, unbounded static caches. Use `using`, bounded `MemoryCache` size limits, and runtime counters.
- Microsoft recommends against `SecureString` for new development and says to prefer an opaque handle to credentials stored outside the process ([SecureString](https://learn.microsoft.com/dotnet/api/system.security.securestring)). A `string` cannot be wiped on demand; `char[]` or `byte[]` can be cleared with `CryptographicOperations.ZeroMemory` for short-lived secrets.

*Statements without a cited Learn page are general practice and were not fetched in this build.*
