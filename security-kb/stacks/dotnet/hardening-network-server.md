# .NET: HTTPS, HSTS, CORS, Kestrel hosting

Companion to `core/hardening-network-server.md`. Microsoft Learn facts checked October 2026 (ASP.NET Core 10.0 pages).

## HTTPS and HSTS ([enforce HTTPS](https://learn.microsoft.com/aspnet/core/security/enforcing-ssl))
- Web apps: `UseHttpsRedirection()` plus `UseHsts()` outside Development. `UseHsts` skips loopback hosts by default and is not recommended in development because browsers cache it.
- HSTS defaults: `MaxAge` 30 days, `IncludeSubDomains` false, `Preload` false. Production often raises max age to one to two years ([Kestrel security considerations](https://learn.microsoft.com/aspnet/core/fundamentals/servers/kestrel/security-considerations)).
- Web APIs: do not listen on HTTP, or close the connection with 400. Do not use `RequireHttpsAttribute` on APIs that receive sensitive data. The default API templates omit HSTS because non-browser callers ignore it. `UseHttpsRedirection` can also cause `ERR_INVALID_REDIRECT` on CORS preflight requests, so API projects can simply reject HTTP.
- `HttpsRedirectionOptions.RedirectStatusCode` defaults to 307; Kestrel's security guidance suggests 308 for production APIs.
- Do not confuse `HTTPS_PORT` (redirect target) with `HTTPS_PORTS` (Kestrel endpoints).

## CORS ([CORS](https://learn.microsoft.com/aspnet/core/security/cors))
- `AllowAnyOrigin` is insecure. `AllowAnyOrigin` with `AllowCredentials` is an insecure configuration that can lead to cross-site request forgery, as is `SetIsOriginAllowed(_ => true)` with credentials.
- Use `WithOrigins(...)`, `WithHeaders(...)`, `WithMethods(...)` and named policies via `RequireCors`. `[DisableCors]` does not disable CORS enabled by endpoint routing with `RequireCors`.
- Wildcard subdomain matching needs `SetIsOriginAllowedToAllowWildcardSubdomains`.

## Kestrel topology
- Edge server: Kestrel does TLS, host filtering (use host filtering middleware), and rate limiting itself. Do not enable forwarded headers.
- Behind a proxy: configure `ForwardedHeadersOptions` for the known proxy. IIS out-of-process hosting applies its own body limit and disables Kestrel's.
- Observability: Kestrel emits metrics such as `kestrel.active_connections` and `kestrel.rejected_connections`, and a `kestrel.connection.duration` histogram with an `error.type` tag. Alert on spikes in rejections. Limits and timeouts: `abuse-and-integrations.md`.

## Production switches to check in `Program.cs`
- `UseDeveloperExceptionPage`, `UseSwagger`/`UseSwaggerUI`, `MapOpenApi`, and database developer pages are inside an `IsDevelopment()` check, or deliberately protected.
- `AllowedHosts` is not `*` where host filtering matters.
- The environment name in production is not `Development`; check `ASPNETCORE_ENVIRONMENT` in deployment manifests.

## Response headers
ASP.NET Core does not add most security headers by default. Add them in middleware or at the proxy and test the result (general practice; see the core document for the list).

*Statements without a cited Learn page are general practice and were not fetched in this build.*
