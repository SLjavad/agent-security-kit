# React: personal data and client telemetry

Companion to `core/pii-and-logging.md`. Checked against the React, MDN, and OWASP documentation in October 2026. In a browser app the logs are made on the user's machine and sent to you, so this document is about what the client sends and what the server accepts.

## What the client reports
- Treat data that arrives from the browser as untrusted. OWASP's logging guidance says data from another trust zone can be missing, modified, forged, replayed, or malicious: validate it, replace malformed fields, and strip carriage-return and line-feed characters before writing it to a log ([Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)). Its list of data to keep out of logs includes session identifiers, access tokens, passwords, and payment card data (same page).
- An error boundary's `componentDidCatch(error, info)` is the usual place to report render errors. The `error` can be any thrown value, so do not assume its shape, and `info.componentStack` names the components and their source locations ([React `Component`](https://react.dev/reference/react/Component)). Report only the error message, the stack, and the component stack. Do not attach props, state, or the form values of the failing component (general practice).
- Error messages can contain what the user typed or what a server returned. Strip or truncate them before sending (general practice).
- Errors thrown in event handlers and in asynchronous code are not caught by an error boundary (same React page), so a separate handler is needed, and it needs the same filtering.

## Source maps
Production component names are minified, and the React documentation says to decode the stack with source maps. Upload the maps to the error-tracking service rather than serving them publicly, unless you decided to publish the source (see `ci-cd-and-secrets.md`) (general practice).

## URLs
- The `Referer` header can leak URLs and URL parameters that contain sensitive data. MDN advises choosing the strictest `Referrer-Policy` that still lets the site work, and the browser default is `strict-origin-when-cross-origin` ([MDN Referrer-Policy guide](https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/Referrer_policy)). Set it explicitly instead of relying on the default.
- Do not put reset tokens, session identifiers, or personal data in routes or query strings. A router's page-view event sends the URL to the analytics tool, and browsers keep it in history (general practice).

## Analytics and session replay
- These tools are third parties that run in your page with your users' privileges (see `abuse-and-integrations.md`). Check what each one collects before enabling it.
- Session-replay and auto-capture features can record what users type. Turn on masking for all inputs by default, and exclude password, payment, and identity fields (general practice).

## Console output
Anything written with `console.log` in production is readable by the user and by browser extensions. Do not log objects that hold tokens or personal data; the ESLint `no-console` rule can enforce this in the build (general practice).

## Review questions
- What does the error reporter send, and does it include props, state, URLs with parameters, or typed values?
- Which analytics or replay tools are loaded, and are inputs masked?
- Does any route or query string carry a token or personal data?

*Statements without a cited page are general practice and were not fetched in this build.*
