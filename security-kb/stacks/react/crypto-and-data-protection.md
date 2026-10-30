# React: secrets, tokens, and cryptography in the browser

Companion to `core/crypto-and-data-protection.md`. Checked against the Vite, OWASP, and MDN documentation in October 2026.

## Nothing in the bundle is secret
Vite exposes variables with the `VITE_` prefix in client-side source code after bundling, and warns that they should not contain sensitive information such as API keys, because their values are bundled into the source at build time. For secrets it points to a backend server or serverless and edge functions ([Vite env variables](https://vite.dev/guide/env-and-mode)). Other build tools use other prefixes (`REACT_APP_`, `NEXT_PUBLIC_`) with the same effect (general practice). The hook rule `react-secret-in-public-env` flags secret-looking names behind a public prefix; it reports the name, never the value.

## Where to keep a session token
- OWASP advises against keeping sensitive information in local storage where authentication would be assumed, and says not to store session identifiers there, because JavaScript can always read them and an XSS flaw can steal everything in the object. Use `sessionStorage` when persistence is not needed ([HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)).
- A session cookie set by the server with the `HttpOnly`, `Secure`, and `SameSite` attributes keeps the value out of script reach (general practice; not fetched in this build). The hook rule `react-token-in-web-storage` flags `setItem` calls whose key name suggests a token or session.

## Random values and cryptography
- `crypto.getRandomValues()` fills an array with cryptographically strong random values; MDN describes `Math.random()` as a non-cryptographic source ([getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)). Use the first for tokens, identifiers, and nonces (general practice for the choice).
- `getRandomValues()` is the only member of the Crypto interface usable from an insecure context, and MDN advises `generateKey()` for key generation because it is guaranteed to run in a secure context (same page). Serve the app over HTTPS.
- Do not use browser code to protect a secret from the person running that browser. Keep keys and critical decisions on the server (`core/crypto-and-data-protection.md`, obfuscation).
- Hash passwords on the server. Hashing in the browser first does not replace that (general practice).

*Statements without a cited page are general practice and were not fetched in this build.*
