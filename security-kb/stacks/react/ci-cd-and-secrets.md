# React: build and CI

Companion to `core/ci-cd-and-secrets.md`. Checked against the npm and Vite documentation in October 2026.

## Build-time values
- Anything a bundler inlines is public. Vite says `VITE_*` values are bundled into the source at build time and must not hold API keys; env files with the `local` suffix are local-only and may hold sensitive variables, and they belong in `.gitignore` ([Vite env variables](https://vite.dev/guide/env-and-mode)). Keep real secrets in a backend the app calls.
- A production build should not read a developer's local env file. Set build variables explicitly in the CI job (general practice).
- Decide on purpose whether production source maps are published. A published map lets anyone read the original source (general practice).

## Pipeline steps
- Install with `npm ci` so the lock file is honoured and a mismatch fails the job ([npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci)). Add `ignore-scripts=true` where your dependencies allow it (`templates/npmrc.snippet`).
- Run `npm audit --audit-level=high`: it exits non-zero at or above that severity ([npm audit](https://docs.npmjs.com/cli/v11/commands/npm-audit)). Run `npm audit signatures` as a separate step to verify registry signatures and provenance.
- Give jobs that build pull requests no deployment or publish credentials (general practice; see the core document).
- Pin the Node image by digest and refresh it on a schedule (`core/ci-cd-and-secrets.md`). If you add a CI template that pins an image, add its file to `PINS` in `tools/check-updates.cjs`.

## Review questions
- Which environment variables are inlined into the production bundle, and does any hold a credential?
- Does the publish token exist in jobs that run code from pull requests?

*Statements without a cited page are general practice and were not fetched in this build.*
