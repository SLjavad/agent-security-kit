# React stack

Security notes for the browser side of a React application: JSX or TSX source, a bundler such as Vite, and npm packages. Facts were checked against the React, npm, Vite, MDN, and OWASP documentation in October 2026 (React 19, npm 11). Each document names its sources.

## Scope
- Covered: npm supply chain and the React Server Components advisory, cross-site scripting and the DOM escape hatches, client-side authorization, secrets and tokens in the browser, build and CI, Content Security Policy and related browser controls, patching (React, Node.js for builds, npm audit), personal data in client telemetry, third-party scripts and what the browser cannot enforce, and showing model output in the interface.
- Not covered: React Native, and server-side details of specific frameworks such as Next.js. Do not apply this stack's notes to those. The other core topics (containers, SBOMs, threat modelling, compliance, privacy requests, business logic, cryptography implementation) have no browser-specific difference, so the core documents apply as they are.

## Detection
`stack.json` detects `*.jsx` and `*.tsx` files. Detection looks at file names only, so it cannot see `package.json`. Other libraries that use TSX (Preact, Solid) also match; check that the project really imports React before applying the notes. The router looks five folders deep, so `apps/web/src/components/` in a monorepo is found, but sources deeper than that are not. React written in plain `.js` files is not detected.

## Hook rules
`hook-rules.json` adds seven checks to the post-edit hook: `dangerouslySetInnerHTML`, DOM HTML sinks, code built from strings, `javascript:` URLs, tokens put in web storage, `postMessage` with a `*` target, and secret-looking names behind a public build prefix. They report the rule name and file name only. The rules match `.js`, `.jsx`, `.ts`, and `.tsx` files, and six of the seven also require a `package.json` that lists `react` or `react-dom` (in the file's folder or a parent up to the git root), so `eval(` in a Node script does not fire. If no `package.json` exists on that path, they fire anyway. `react-secret-in-public-env` has no such condition, because the public prefixes (`VITE_` and the others) are not specific to React.

## Templates
- `templates/eslint-security.snippet`: ESLint rules for the dangerous JSX patterns.
- `templates/npmrc.snippet`: `ignore-scripts` and `min-release-age` for `.npmrc`.
