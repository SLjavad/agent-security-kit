# Authorization and tenant isolation

Applies to any language or framework. Items marked (general practice) are not from a fetched source.

## Why it matters
Broken object-level authorization is among the most common serious API flaws: the caller is authenticated but can read or change someone else's record by changing an identifier. Scanners rarely find it, because the code is "correct" until you ask who owns the object.

## Review checklist
1. Every endpoint, handler, or message consumer states its authorization requirement explicitly. A missing requirement is a finding, not a default. (general practice)
2. Authorization is enforced on the server for every request. Hiding a button or link is not an authorization check; a user can call the endpoint directly.
3. Access to a specific record is decided against the loaded record (resource-based), not only against the caller's role. Check the record for null or not-found before using it.
4. Rules live in one place (policies, guards, middleware) with small, tested decision functions, not scattered `if` statements.
5. Identifiers from the client are never trusted as proof of ownership. The owner comes from the authenticated principal or a server-side lookup. (general practice)
6. Lists, searches, exports, and bulk endpoints apply the same ownership filter as single-record reads. They are the usual place to find missing checks. (general practice)
7. Responses return only the fields the caller may see. Check for entities returned directly, internal tokens, and operator-only fields. (general practice)
8. Service-to-service calls authenticate the calling service and authorize the action. Network location is not authentication. (general practice)
9. Admin and support tools use separate, audited paths. A role check alone must not silently bypass tenant boundaries. (general practice)

## Multi-tenant data
- Prefer scoping every query to the current tenant by default (a data-layer filter, row-level security, or a per-tenant database), so a developer cannot forget it.
- Search for every place the default scoping is switched off or bypassed. Each is a deliberate removal of the tenant boundary and needs a reason and a test.
- Raw queries, stored procedures, reports, and search indexes usually bypass framework-level filters. Confirm the tenant condition is written into them.
- With a database or connection per tenant, check that a cached or shared object cannot carry one tenant's connection into another tenant's request.
- Background jobs and message consumers have no HTTP user. Check how they establish tenant context and that it cannot leak between messages.
- Caches: include the tenant or user in the cache key whenever content differs by caller.

## Property-level authorization
Object-level checks answer "may this user see this record". They do not answer "may this user see or change **this field**".
- **Output:** return an explicit allow-list of fields per role. Do not serialise the stored entity and hope sensitive fields are hidden; fields added later leak by default.
- **Input (mass assignment):** bind requests to a dedicated input shape that lists only the fields the caller may set. Never bind straight onto the stored entity, or a caller can set role, owner, tenant, price, status, or approval flags.
- **Sensitive fields need their own rule:** role and permission changes, ownership transfer, tenant ID, price or discount, verified or approved state, and balances change only through dedicated operations with their own authorization and audit.
- **Test it:** send extra fields in create and update requests and assert they are ignored or rejected; compare the fields returned to a low-privilege user against the allow-list.

## Tests worth requiring
- Two tenants, two users: user A requests user B's record by id on every endpoint and expects 403 or 404.
- A list endpoint returns only the caller's rows.
- Disabling the tenant scoping in a test makes at least one test fail.

## Common mistakes
- Checking the role but not the record.
- Authorizing the parent object and trusting a child id from the request.
- Returning 403 for some missing records and 404 for others, which reveals which ids exist.
- Trusting a tenant id sent by the client.

Further reading: OWASP API Security Top 10 (https://owasp.org/www-project-api-security/), not fetched in this build.

*Stack-specific notes: `stacks/<stack>/authz-and-tenant-isolation.md` for the detected stack, when present.*
