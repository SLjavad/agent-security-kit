# .NET: authorization and tenant isolation

Companion to `core/authz-and-tenant-isolation.md`. Covers ASP.NET Core and EF Core. Microsoft Learn pages checked October 2026 and shown for ASP.NET Core 10.0 unless stated.

## ASP.NET Core
- **Policies:** put rules in authorization policies and handlers ([policy-based authorization](https://learn.microsoft.com/aspnet/core/security/authorization/policies)). Every endpoint carries `[Authorize]` or `RequireAuthorization(...)`, or an explicit `AllowAnonymous` that you can justify. A fallback policy that requires an authenticated user makes "forgot the attribute" fail closed.
- **Per-record checks:** use resource-based authorization: load the record, then call `IAuthorizationService.AuthorizeAsync(user, resource, policy)` ([resource-based authorization](https://learn.microsoft.com/aspnet/core/security/authorization/resource-based)). The `resource` parameter is optional and may be null, so check it before use.
- **UI hiding is not authorization.** Learn warns that hiding a button does not stop a user calling the action if they know the URL ([view-based authorization](https://learn.microsoft.com/aspnet/core/mvc/security/authorization/views)). Each action needs its own check.
- **Minimal APIs and controllers:** confirm both styles are covered. A mix of controllers and minimal endpoints is a common place to find an unprotected route.
- **Search patterns:** endpoints lacking `[Authorize]`/`RequireAuthorization`, `[AllowAnonymous]`, `Request.Headers["X-...Id"]` used as identity, and DTOs that bind an `OwnerId`, `TenantId`, or `UserId` from the request body.

## EF Core multi-tenancy
- With a tenant column, use global query filters (`HasQueryFilter`) so each query is scoped by default ([global query filters](https://learn.microsoft.com/ef/core/querying/filters), [multi-tenancy](https://learn.microsoft.com/ef/core/miscellaneous/multitenancy)). The context must receive the current tenant id (constructor or service), so make sure it cannot be constructed without one.
- Search for `IgnoreQueryFilters`. Each use removes the tenant boundary for that query. With EF 10 named filters you can disable one filter and keep the other, so check which one is being disabled.
- Before EF 10, only one filter per entity type is possible without combining conditions with `&&`; a second `HasQueryFilter` call overwrites the first.
- `FromSql`, stored procedures, and `ExecuteSql` bypass query filters. Confirm the tenant condition is written into them.
- Database-per-tenant: the connection string is chosen per request. Learn notes the context factory lifetime must be scoped when the connection varies per user; a singleton factory shares one configuration across all users.
- Check background services and message handlers: there is no `HttpContext`, so how is the tenant set?

## Tests
Use `WebApplicationFactory` integration tests with two seeded tenants and users, and assert 403 or 404 on cross-tenant reads, on list endpoints, and on exports.

*Statements without a cited Learn page are general practice and were not fetched in this build.*
