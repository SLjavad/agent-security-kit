# .NET: performance-related denial-of-service points

Companion to `core/performance-vs-security.md`. Microsoft Learn facts checked October 2026.

## .NET-specific places to look
- **Thread-pool starvation.** Kestrel disables synchronous I/O by default (`AllowSynchronousIO` false) because blocked threads under load make the app unresponsive ([Kestrel security considerations](https://learn.microsoft.com/aspnet/core/fundamentals/servers/kestrel/security-considerations)). Search for `.Result`, `.Wait()`, `.GetAwaiter().GetResult()` and synchronous `Stream` calls on request paths.
- **Rate limiter choice.** Learn advises choosing a limiter by endpoint cost; the concurrency limiter caps simultaneous requests ([rate limiting](https://learn.microsoft.com/aspnet/core/performance/rate-limit)). Apply it to expensive endpoints.
- **Regex.** Use match timeouts or `RegexOptions.NonBacktracking` ([best practices](https://learn.microsoft.com/dotnet/standard/base-types/best-practices-regex)).
- **EF Core.** Look for missing `Take`/pagination, `ToList()` on unfiltered `DbSet`, lazy loading in loops (N+1), and `Include` chains that return whole object graphs from list endpoints. Prefer projections (`Select`) for list responses.
- **Large bodies.** Check `MaxRequestBodySize`, form and multipart limits, and `[RequestSizeLimit]` on upload actions.
- **Outbound calls.** `HttpClient.Timeout`, cancellation tokens flowed from `HttpContext.RequestAborted`, and bounded retry policies.
- **Caches.** `MemoryCache` with `SizeLimit` set and entry sizes declared; keys that include the user or tenant where content differs.
- **Background work.** Bounded `Channel<T>` capacities and bounded consumer parallelism.

## Measuring bottlenecks (not security)
Use `dotnet-counters`, `dotnet-trace`, and a benchmark harness such as BenchmarkDotNet on a staging copy. (general practice; tool names not fetched)

*Statements without a cited Learn page are general practice and were not fetched in this build.*
