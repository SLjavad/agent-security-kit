# React: browser-side hardening and delivery

Companion to `core/hardening-network-server.md`. Checked against MDN and OWASP guidance in October 2026. These controls limit the damage when a script injection gets through; they do not replace the escaping and sanitizing in `injection-deserialization-memory.md`.

## Content Security Policy
- A CSP is mainly a defence against XSS and works as defence in depth even if sanitization fails; it is not an alternative to sanitizing input ([MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)).
- MDN recommends a strict policy built on nonces or hashes over host allowlists, which are hard to get right. A nonce must differ for every response and be unpredictable, so the server must generate it; hashes suit static pages but must be recalculated whenever a script changes. A starting policy from the page: `script-src 'nonce-{RANDOM}'; object-src 'none'; base-uri 'none'`. A statically hosted single-page app cannot add a per-response nonce itself (general practice); use hashes, or serve the page through a server or edge function.
- Avoid `'unsafe-inline'` and `'unsafe-eval'`. The first re-enables inline scripts, event handlers, and `javascript:` URLs; the second re-enables `eval()` and string arguments to timers (same page). Check the final built HTML against the policy, because build tools can inject inline scripts (general practice).
- Test with `Content-Security-Policy-Report-Only` first. Unless the app must be embedded, set `frame-ancestors 'none'` (same page).

## Trusted Types
Trusted Types turn DOM XSS sinks into type errors: with `require-trusted-types-for` set, passing a string to a sink throws a `TypeError`, and `trusted-types` allow-lists the policy names. React accepts a `TrustedHTML` value in `dangerouslySetInnerHTML` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API), [React](https://react.dev/reference/react-dom/components/common)). MDN lists the feature as available across the latest browsers since February 2026, and a stand-in that returns plain strings gives no runtime enforcement: test on a supporting browser with the directive on.

## Third-party scripts and frames
- Subresource Integrity makes the browser refuse a script or stylesheet whose hash does not match, which guards against a compromised host. Cross-origin use needs `crossorigin` and a server that sends CORS headers. A file that changes no longer matches its hash, so regenerate the hash with each change (general practice) ([MDN SRI](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity)).
- Put untrusted content in an `iframe` with the `sandbox` attribute (OWASP, [HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)).

## Messages between windows
Verify the sender with `event.origin` (and `event.source`), then validate the message's structure. Always give an exact target origin, not `*`. If the app expects no messages, add no `message` listener ([MDN postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)). The hook rule `react-postmessage-wildcard` flags the wildcard form.

## Cross-origin requests
Allow only selected, trusted domains in `Access-Control-Allow-Origin`. CORS does not stop requested data going to an unauthorized place, and the `Origin` header alone is not an access check (OWASP, same cheat sheet).

*Statements without a cited page are general practice and were not fetched in this build.*
