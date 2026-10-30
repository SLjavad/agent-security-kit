# React: npm supply chain

Companion to `core/dependency-supply-chain.md`. Checked against the npm CLI documentation (npm 11) and the React documentation in October 2026. Name the npm and React versions you are advising for.

## Repeatable installs and vulnerability data
- Install with `npm ci` in CI: it needs an existing `package-lock.json` or `npm-shrinkwrap.json`, exits with an error instead of updating the lock when it disagrees with `package.json`, removes an existing `node_modules` first, and never writes to `package.json` or the lock ([npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci)). Commit the lock file for applications (general practice).
- `npm audit` sends a description of the dependencies to the registry and reports known vulnerabilities. By default it exits non-zero on any finding; `--audit-level` sets the lowest severity that fails the command and does not filter the report. It needs a lock file by default, and with `--no-package-lock` results can differ on each run ([npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit)).
- `npm audit signatures` verifies registry signatures (only `ecdsa-sha2-nistp256` is supported) and provenance attestations of downloaded packages. It works only with registries that support signatures, and attestation formats may change, so keep npm current (same page).
- Audit data covers published advisories only. A malicious package with no advisory is not reported (`core/dependency-supply-chain.md`).

## Install scripts and new releases
- `ignore-scripts=true` stops npm running scripts from `package.json` files. Commands that run one named script (`npm start`, `npm test`, `npm run`) still run that script but not its pre- and post-scripts ([npm config](https://docs.npmjs.com/cli/v11/using-npm/config)). Run only the builds you need, explicitly, after `npm ci` (general practice). A ready snippet is `templates/npmrc.snippet`.
- The npm 11 docs list `min-release-age` (a number of days, default none) and `min-release-age-exclude`. Check that your npm version supports them before relying on them (same page).

## React packages and frameworks
- In December 2025 the React team published CVE-2025-55182, an unauthenticated remote code execution in React Server Components, rated CVSS 10.0. Affected: `react-server-dom-webpack`, `react-server-dom-parcel`, and `react-server-dom-turbopack` in 19.0, 19.1.0, 19.1.1, and 19.2.0; fixed in 19.0.1, 19.1.2, and 19.2.1. Frameworks and plugins that bundle or depend on them were affected too: next, react-router, waku, @parcel/rsc, @vitejs/plugin-rsc, and rwsdk. Later advisories on the same page add denial-of-service and source-exposure CVEs, the latest in January 2026. An app whose React code does not use a server, or that uses no framework, bundler, or plugin supporting Server Components, is not affected ([advisory](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)). Take fixed framework versions from the framework's own advisory, not from this note: the React page lists two different Next.js 15.4 fixes.
- Create React App is deprecated and has no active maintainers; it keeps working in maintenance mode. The React team recommends a framework for new apps, or a build tool such as Vite, Parcel, or Rsbuild ([post of 14 February 2025](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)). Treat a CRA project as an unmaintained dependency and plan a move.

## Review before adding a package
Check the package's publisher, release history, install scripts, and whether a browser or React built-in already does the job (general practice). A UI component library runs with the full privileges of your page, so review it like application code.

*Statements without a cited page are general practice and were not fetched in this build.*
