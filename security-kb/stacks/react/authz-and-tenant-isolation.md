# React: authorization in a browser front end

Companion to `core/authz-and-tenant-isolation.md`. Checked against OWASP and the React documentation in October 2026. Everything in the browser belongs to the person using it, so no decision made there is a security decision.

## Rules
- Do not rely on client-side access control checks. Checks must run server-side, at a gateway, or in serverless functions. Validate permissions on every request, and deny by default ([OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)).
- Route guards, hidden menu items, and disabled buttons are user experience. A user can call the API directly, so each endpoint needs its own check (general practice, consistent with the page above).
- In a Server Function, validate that the logged-in user may perform the action, and treat every argument as untrusted. Server Functions are exposed server endpoints that client code can call from anywhere ([use server](https://react.dev/reference/rsc/use-server)).

## What to search for
- Role or permission values read from client state, `localStorage`, or a decoded token and used to decide what the user may do. They are display hints only.
- Request bodies that carry `userId`, `tenantId`, `ownerId`, or `role` taken from client state. The server must derive them from the authenticated session.
- Components that fetch data by an id from the URL with no server-side ownership check behind the endpoint.

## Client state after sign-out or account switch
Clear query caches, state stores, and persisted storage on sign-out and when the account changes, and include the user or tenant in cache keys when content differs by caller (general practice). A stale cache shows the previous user's data to the next one on a shared device.

## Tests worth requiring
Call each API route as a user of another tenant and expect 403 or 404, with the UI bypassed. Sign out and in as a second user in the same tab and confirm no first-user data appears.

*Statements without a cited page are general practice and were not fetched in this build.*
