# Network, transport, and server hardening

Applies to any stack. Framework middleware, defaults, and settings are in the stack document. Items marked (general practice) are not from a fetched source.

## Transport security
- Serve everything over HTTPS. Redirect browsers from HTTP, and send HTTP Strict Transport Security (HSTS) in production. HSTS needs one successful HTTPS visit, is cached by browsers, and should not be enabled for local development. Add subdomain and preload options only when every subdomain really serves HTTPS.
- Web APIs: do not listen on plain HTTP, or refuse the request. A redirect can make clients send sensitive data over HTTP first. Non-browser callers ignore HSTS.
- Behind a reverse proxy that terminates TLS and handles redirects and HSTS, the application need not repeat them. Then protect the proxy-to-application hop (private network) and trust forwarded headers only from the proxy.
- Allow current TLS protocol versions only, disable legacy ones, use certificates from your CA with automated renewal, and monitor expiry. (general practice)

## Cross-origin resource sharing (CORS)
- Allowing every origin is insecure: any website can call the API from a victim's browser. Allowing every origin together with credentials is an insecure configuration that can lead to cross-site request forgery.
- List exact origins, methods, and headers, allow credentials only when required, and prefer named policies applied per endpoint over a permissive global default.
- CORS is a browser rule. It does not authenticate or authorize anything.

## Exposure topology
- **Directly on the internet:** the application server does TLS, host filtering, and rate limiting itself. Do not process forwarded headers. Do not treat server limits as DDoS protection.
- **Behind a proxy:** configure forwarded headers for the known proxy only. Check that limits are set where the request first lands.
- Limits and timeouts: see `abuse-and-integrations.md`.
- Make rejected and malformed requests observable (logs or metrics) and alert on spikes.

## Response headers (general practice)
Set and test: `Content-Security-Policy` (or at least `frame-ancestors`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and `Cache-Control: no-store` on sensitive responses. Remove version-revealing headers. APIs that return JSON need fewer headers than web pages; test what matters for your clients.

## Server and container configuration (general practice)
- Run as a non-root, least-privilege account. No interactive shell in production containers.
- Read-only root filesystem where possible; writable paths are explicit.
- Minimal base image; no build tools in the runtime image.
- Secrets arrive at runtime, never baked into images (`ci-cd-and-secrets.md`).
- Close unused ports and management interfaces. Put admin endpoints on a private network or behind strong authentication.
- Host firewall default deny inbound. Egress allow-list for services that call out.
- Disable directory listing, debug endpoints, API explorers, and developer error pages in production.
- Separate environments: distinct credentials, networks, and data for development, staging, and production.
- Database accounts used by the application have only the permissions it needs; no administrative rights and no schema changes at runtime.
- Time is synchronised, and logs are shipped off the host.

## Detection basics
Intrusion detection is an operations function. A review cannot replace it, but it can check that the signals exist:
- Sign-in failures, lockouts, privilege and permission changes, and sensitive state changes are logged with user, time, and source.
- Rate-limit rejections and server rejection metrics are collected and alerted on.
- Logs leave the host and are retained, searchable, and monitored by a person or a rule.
- Someone owns the alerts and has a response runbook (`threat-model-and-ir.md`).

## Verifying the live system
A source review cannot see deployed configuration. The owner can run, against **staging only** and with authorisation, a TLS configuration test, a security-header check, and a dynamic web scanner baseline, and share the results. Mark anything that depends on deployment settings as needs-validation.

## Checklist
- [ ] HTTPS everywhere, HSTS in production, APIs not served over HTTP
- [ ] CORS lists exact origins; credentials only where needed
- [ ] Forwarded headers trusted only from the known proxy
- [ ] Debug, API explorer, and developer error pages off in production
- [ ] Non-root runtime, minimal image, secrets injected at runtime
- [ ] Security events logged and alerted; owner named

*Stack-specific notes: `stacks/<stack>/hardening-network-server.md` for the detected stack, when present.*
