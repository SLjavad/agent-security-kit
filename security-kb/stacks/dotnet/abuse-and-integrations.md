# .NET: rate limiting, Kestrel limits, regex, forwarded headers

Companion to `core/abuse-and-integrations.md`. Microsoft Learn facts checked October 2026 (ASP.NET Core 10.0 pages unless stated).

## Rate limiting middleware
- ASP.NET Core ships fixed window, sliding window, token bucket, and concurrency limiters. Register with `AddRateLimiter` and enable with `UseRateLimiter`; omitting `AddRateLimiter` breaks the middleware ([rate limiting](https://learn.microsoft.com/aspnet/core/performance/rate-limit)).
- Partition with `PartitionedRateLimiter` or `RateLimitPartition`: authenticated user id or API key first, remote IP for anonymous traffic. A `GlobalLimiter` runs before endpoint policies; attach endpoint policies with `RequireRateLimiting`.
- Set `RejectionStatusCode` to 429 and use `OnRejected` to add `Retry-After` where the algorithm can estimate it.
- Learn: choose the limiter by endpoint cost; the concurrency limiter limits simultaneous requests and cannot estimate a retry time.
- Time-based limiters do not return permits when a later chained limiter rejects the request; order chained limiters with that in mind.

## Kestrel limits (from [Kestrel security considerations](https://learn.microsoft.com/aspnet/core/fundamentals/servers/kestrel/security-considerations))
- `MaxRequestBodySize` default about 28.6 MB (30,000,000 bytes). Lower it for APIs without uploads and raise it per endpoint with `[RequestSizeLimit]` or `IHttpMaxRequestBodySizeFeature` (only before the body is read).
- Header limits: request line 8 KB, total headers 32 KB, header count 100. `RequestHeadersTimeout` 30 s; `MinRequestBodyDataRate` and `MinResponseDataRate` 240 bytes/s with a 5 s grace period. `MinResponseDataRate` is less effective on HTTP/2 and HTTP/3.
- `MaxConcurrentConnections` and `MaxConcurrentUpgradedConnections` are unlimited by default. Limits protect memory but can refuse legitimate traffic in a surge; observe metrics first.
- `AllowSynchronousIO` is false by default to prevent thread-pool starvation. Keep it; enable per request if legacy code needs it.
- WebSockets accept any origin unless `WebSocketOptions.AllowedOrigins` is set, are not bound by `MaxRequestBodySize`, and `KeepAliveTimeout` is disabled by default. Validate message sizes in code.
- Do not treat Kestrel limits as DDoS protection.

## Regular expressions
- Set a match timeout (`new Regex(pattern, options, timeout)` or `Regex.Match(..., matchTimeout)`) or use `RegexOptions.NonBacktracking` (.NET 7 and later); catch `RegexMatchTimeoutException` ([best practices](https://learn.microsoft.com/dotnet/standard/base-types/best-practices-regex)). Learn states the engine does not protect against hostile patterns, so never build patterns from user input; use `Regex.Escape` for literals.
- Analyzer CA3012 flags HTTP request input reaching a regex ([CA3012](https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/ca3012)). It cannot track data across assemblies.
- A process-wide default is possible with the `REGEX_DEFAULT_MATCH_TIMEOUT` app-domain setting.

## Forwarded headers
If Kestrel is directly exposed, do not enable forwarded-headers processing, and check the `ASPNETCORE_FORWARDEDHEADERS_ENABLED` environment variable is not set. Behind a proxy, configure `ForwardedHeadersOptions` with the known proxy addresses only (Kestrel security considerations).

## Outbound calls and webhooks
- Use `IHttpClientFactory`; set `HttpClient.Timeout` and cancellation tokens; add resilience handlers with bounded retries.
- Verify webhook signatures with `CryptographicOperations.FixedTimeEquals` over the raw request body (see `crypto-and-data-protection.md`).
- User-supplied URLs: validate host and resolved address before `HttpClient` calls; set `AllowAutoRedirect = false` on the handler and validate each hop yourself.

*Statements without a cited Learn page are general practice and were not fetched in this build.*
