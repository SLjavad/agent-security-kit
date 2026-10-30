# React: abuse and third-party integrations

Companion to `core/abuse-and-integrations.md`. Checked against the OWASP and Vite documentation in October 2026. The server-side items in the core document (rate limits, webhooks, request-forgery defences) belong to the back end the app calls; this document covers what a browser app adds.

## The browser is not a control point
- Validation, debouncing, disabled buttons, and client-side rate limiting improve the experience but stop nobody: an attacker calls the API directly. Enforce limits, validation, and authorization on the server (general practice; see `authz-and-tenant-isolation.md`).
- Everything in the bundle is public. Vite states that `VITE_*` values are bundled into the source and must not hold API keys ([Vite env variables](https://vite.dev/guide/env-and-mode)). Use a key in the browser only if the provider designed it to be public, and restrict it at the provider by origin, scope, and quota (general practice). Keep real secrets behind a back end that checks who is asking.

## Third-party scripts
OWASP names three risks of loading third-party JavaScript: the hosted code can change at any time, it runs with the same privileges as the user, and it can send out browser data such as the referrer. It calls compromise of the vendor's server the single greatest risk ([Third Party JavaScript Management](https://cheatsheetseries.owasp.org/cheatsheets/Third_Party_Javascript_Management_Cheat_Sheet.html)). Its controls:
- Use Subresource Integrity so only reviewed code runs, and monitor the vendor for changes, because an update breaks a pinned hash.
- Load vendor code in a sandboxed iframe so it cannot reach your DOM or cookies; communicate with `postMessage` (see `hardening-network-server.md` for the origin checks).
- Add a Content Security Policy as well for high-risk applications.
- A tag manager or data layer is not a sandbox. Restrict who can publish to it and review those changes like application code.
- Audit the scripts that actually load before claiming that only first-party code runs.

An npm package is third-party code with the same privileges as your own (see `dependency-supply-chain.md`).

## Redirects and links
A destination taken from the URL or an API response (a "return to" address after sign-in, a link in user content) can send people to an attacker's site. Accept only relative paths or an allow-list of hosts, and never pass the value to a `javascript:` or `data:` target (see the hook rule `react-javascript-url`) (general practice).

## Review questions
- Which keys and tokens are in the production bundle, and is each one meant to be public and restricted at the provider?
- Which third-party scripts load on pages that handle credentials or payments, and are they isolated, hashed, or covered by the policy?
- Does any control exist only in the browser?

*Statements without a cited page are general practice and were not fetched in this build.*
