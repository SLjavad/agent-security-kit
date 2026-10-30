# React: cross-site scripting and untrusted data

Companion to `core/injection-deserialization-memory.md`. Checked against the React documentation (React 19) and OWASP and MDN guidance in October 2026. In a browser front end, the injection that matters is cross-site scripting (XSS): attacker text reaching a place that executes it.

## What React protects, and the escape hatches
- React DOM escapes values embedded in JSX before rendering them ([introducing JSX](https://legacy.reactjs.org/docs/introducing-jsx.html), legacy documentation). The risk is in the ways around it.
- `dangerouslySetInnerHTML` takes `{ __html: ... }` with an HTML string or a `TrustedHTML` value. React's page says to use it "only with trusted and sanitized data" and that otherwise it is trivial to introduce XSS ([common components](https://react.dev/reference/react-dom/components/common)). It advises creating the object where the HTML is generated, not inline at the element. With Trusted Types enforced, pass a `TrustedHTML` made by your policy; the policy must still ensure its input is trusted and sanitized (same page).
- OWASP recommends DOMPurify for sanitizing HTML, preferring text sinks such as `textContent`, and warns that modifying sanitized content afterwards can void the protection. Patch the sanitizer regularly ([XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)).

## URLs
- OWASP's XSS page says React 19 blocks `javascript:` URLs in `src` and `href`, and that this does not replace application-specific URL validation. For untrusted URLs it recommends allow-listing `http` and `https` (same page).
- The lint rule `react/jsx-no-script-url` disallows `javascript:` URLs ([rule](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-script-url.md)).

## Sinks outside React
Trusted Types groups the dangerous browser APIs into HTML sinks (`Element.innerHTML`, `document.write()`), JavaScript sinks (`eval()`, `HTMLScriptElement.text`), and script URL sinks (`HTMLScriptElement.src`) ([Trusted Types](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API)). Search for these in code that touches the DOM directly, in refs, effects, and third-party widgets.

## Server-rendered state
Embedding state in a script tag with `JSON.stringify` "can be subject to script injections". Replace `<` with `<` in the output, or use a serializer such as `serialize-javascript` ([Redux server rendering](https://redux.js.org/usage/server-rendering)).

## Server Functions
Arguments to Server Functions are "fully client-controlled": treat them as untrusted, validate and escape them, and check that the logged-in user may perform the action ([use server](https://react.dev/reference/rsc/use-server)). The decoding of those payloads was itself the subject of CVE-2025-55182; see `dependency-supply-chain.md`.

## Lint and hook checks
- `react/no-danger` disallows "dangerous JSX properties". Its `customComponentNames` option defaults to an empty list, so your own components are not checked unless you list them (`['*']` checks all) ([rule](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-danger.md)). A snippet is in `templates/eslint-security.snippet`.
- The hook rules `react-dangerous-html`, `react-dom-html-sink`, `react-code-from-string`, and `react-javascript-url` flag the common forms of the patterns above.
- Search patterns: `dangerouslySetInnerHTML`, `innerHTML =`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function(`, `href={` built from request data, and deep-merge helpers fed with parsed JSON (prototype pollution, general practice).

## Memory
Browser JavaScript is memory-safe. Native addons in build tooling and WebAssembly modules are the exceptions (general practice).

*Statements without a cited page are general practice and were not fetched in this build.*
