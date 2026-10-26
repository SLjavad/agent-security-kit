# .NET: redaction and error handling

Companion to `core/pii-and-logging.md`. Microsoft Learn facts checked October 2026.

## Redaction in the logging pipeline
- Mark sensitive values with a data classification and redact them in the logging pipeline with `Microsoft.Extensions.Compliance.Redaction` and `Microsoft.Extensions.Telemetry`: register redactors per classification (`AddRedaction`) and enable redaction on the logging builder (`builder.EnableRedaction()`) ([data redaction](https://learn.microsoft.com/dotnet/core/extensions/data-redaction), [source-generated logging](https://learn.microsoft.com/dotnet/core/extensions/logging/source-generation)).
- With `[LoggerMessage]` source-generated methods, put the classification attribute on the parameter.
- Built-in redactors: `ErasingRedactor` (empty string) and `HmacRedactor` (HMAC-SHA256). HMAC lets you correlate events about one person without storing the value; keep the key out of the logs.
- Learn's guidance: review log output regularly to confirm nothing sensitive appears.
- HTTP client logging redacts paths by default. `RequestPathParameterRedactionMode.None` can expose identifiers in paths; use it only in development.
- Search patterns: `LogInformation($"...")` with interpolated personal data, `{@Object}` destructuring of entities, `JsonSerializer.Serialize(request)` in log calls, `ex.ToString()` written to responses.

## Errors
- Enable the Developer Exception Page only in the Development environment; it shows stack traces, query strings, cookies, and headers ([error handling](https://learn.microsoft.com/aspnet/core/fundamentals/error-handling)).
- Elsewhere use `UseExceptionHandler` with `AddProblemDetails()`, which returns a generic RFC 7807 payload with a trace id. Learn warns not to serve sensitive error information to clients.
- If you implement `IExceptionHandler` and return `true`, write the complete response including the status code, or the client sees a 404.
- Kestrel logs rejected malformed requests at Debug under `Microsoft.AspNetCore.Server.Kestrel.BadRequests`; enable that category deliberately if you want to see them in production.
- Check that `AddDatabaseDeveloperPageExceptionFilter` and `UseDeveloperExceptionPage` are guarded by an environment check.

*Statements without a cited Learn page are general practice and were not fetched in this build.*
