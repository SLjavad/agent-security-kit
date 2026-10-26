# Abuse, availability, and third-party integrations

Applies to any stack. Limits, defaults, and middleware names are stack-specific; use the stack document. Items marked (general practice) are not from a fetched source.

## Rate limiting
- Limit by endpoint cost, not only by count: consider CPU, time, data access, and I/O. A cheap list call and an expensive report need different limits. Concurrency limits bound simultaneous work, while rate limits bound requests per period.
- Partition by something an attacker cannot rotate cheaply: authenticated user id or API key, then network address for anonymous traffic.
- Return a clear "too many requests" status and a retry hint where possible.
- Apply stricter limits to sign-in, password reset, one-time codes, search, export, and anything expensive or record-creating.

## Request and connection limits
- Set maximum request body size, header size and count, and read timeouts for the deployment topology. Defaults are often generous (tens of megabytes). Lower them for APIs without uploads and raise them per endpoint where needed.
- Set minimum data rates or timeouts against slow-client attacks.
- Bound long-lived connections (WebSockets, streaming) and validate message sizes in code, because body limits often do not apply to them.
- Server limits are not a substitute for upstream protection against volumetric attacks.

## Regular expressions and parsing
- Regular expressions with nested quantifiers on untrusted input can take exponential time. Set a match timeout, use a non-backtracking engine or mode, and never build patterns from user input.
- Bound the size and nesting depth of JSON, XML, and archive input. Paginate every list endpoint and cap the page size. (general practice)

## Queues and background work (general practice)
- Poison messages: bounded retries, then a dead-letter queue with alerting. An endless retry loop is a self-inflicted outage.
- Bound queue length and consumer concurrency. A producer you do not control must not be able to fill your queue.
- Jobs triggered by users need per-user limits.

## Webhooks and callbacks (general practice)
- Verify a signature computed over the raw body with a shared secret, compare in constant time, and reject stale timestamps.
- Record each delivery id and reject repeats (replay).
- Do not treat the payload as the source of truth for money or state. Re-fetch from the provider or reconcile.
- Respond quickly and process asynchronously. Never run long work inside the callback.
- Allow-listing sender IP ranges is an extra layer only; ranges change and can be spoofed behind some proxies.

## Outbound calls and SSRF (general practice)
- When a user supplies a URL (webhook target, image fetch, import), a server-side fetch can reach internal services and cloud metadata endpoints. Allow-list hosts, resolve DNS and check the address against private ranges after resolution, disable redirects or re-validate each hop, and cap response size and time.
- Give every outbound call a timeout and a retry limit, and use a shared client or connection pool.
- Run services with egress rules that allow only what they need.

## Trusting upstream data (general practice)
Data from suppliers and partners is input. Validate type, range, length, and encoding, escape it for the place it is shown, and never let it choose file paths, queries, or code to run. Decide what happens when the upstream is down, slow, or wrong.

## Reverse proxies and forwarded headers
Behind a reverse proxy, trust `X-Forwarded-*` style headers only from that proxy. If the server is directly exposed, do not process them: any client could spoof its address, scheme, and host.

## Checklist
- [ ] Global and per-endpoint rate limits, with stricter limits on authentication and expensive routes
- [ ] Body size, header, and timeout limits reviewed for the deployment topology
- [ ] Regular expressions on untrusted input have a timeout or a non-backtracking mode
- [ ] Every list endpoint paginates with a maximum page size
- [ ] Webhooks verified, de-duplicated, and reconciled
- [ ] Outbound calls have timeouts and an egress allow-list; user-supplied URLs are validated

*Stack-specific notes: `stacks/<stack>/abuse-and-integrations.md` for the detected stack, when present.*
