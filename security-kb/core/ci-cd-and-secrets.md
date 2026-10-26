# CI/CD and secrets lifecycle

A build pipeline can publish to production, so it is a target. Applies to any CI system. Items marked (general practice) are not from a fetched source.

## Secrets: where they may live
- Never in source code, committed configuration, or package manager configuration. Production secrets are not used in development or test, and are not deployed inside the application artifact.
- Development: a local secret store or environment variables kept outside the repository.
- Environment variables are plain text. If the machine or process is compromised they are readable. Acceptable for low-risk values, not a vault.
- Production: a secret manager read at startup using the workload's own identity. Prefer short-lived credentials issued to the workload over long-lived passwords. (general practice)

## Pipeline checklist (general practice)
1. **Least privilege.** The job token or deploy identity can do only what the job needs, in only the projects it needs. Separate identities for build, test, and deploy.
2. **Protected variables.** Production credentials are available only to protected branches and tags, and are masked in logs. Pipelines triggered from forks or untrusted merge requests never receive them.
3. **Branch protection.** Deploy jobs run only from protected branches. Pushing to them requires review.
4. **Pinned inputs.** Reference images, includes, actions, and third-party templates by digest or commit, not a moving tag. Review updates.
5. **No remote-script execution.** No download-and-pipe-to-shell in jobs. Download, verify a checksum or signature, then run.
6. **Runners.** Shared runners run untrusted code. Use isolated, ephemeral runners for jobs with secrets. Do not run privileged containers or mount the host container socket for ordinary builds.
7. **Artifacts and logs.** Artifacts expire. Logs never print secrets; masking is a backstop, not a design. Do not upload production configuration or key files as artifacts.
8. **Registry access.** Pull credentials are read-only for build jobs. Push rights belong to the release job only.
9. **Traceability.** Record which commit and pipeline built each deployed artifact (build metadata or image labels), and deploy by an immutable digest or exact version, so you can always say what is running and where it came from.
10. **Dependency installs.** Locked installs with audit enabled; see `dependency-supply-chain.md`.
11. **Secret scanning.** Scan every push with a secret scanner (for example gitleaks, whose README documents `gitleaks git` and `gitleaks dir`, `--redact`, and `--exit-code`; `detect` and `protect` are deprecated since v8.19.0). A ready configuration is in `templates/gitleaks.toml` and `templates/gitlab-ci-secret-scan.yml`.
12. **AI agents in CI.** Never give a pipeline agent write access and untrusted input together. See `ai-tooling-security.md`.

## Rotation and response
- Keep an inventory: each secret, its owner, where it is used, and when it was last rotated.
- Rotate on a schedule, and immediately when a person with access leaves or a leak is suspected.
- A committed secret is compromised. Rotate it first, then remove it from history. Removing the commit does not un-leak the value.
- Test rotation. A secret nobody has rotated in practice may not be rotatable.

## Review questions
- Which jobs can read production credentials, and from which branches?
- If a developer laptop is stolen, which secrets does it hold?
- If a dependency's build script is malicious, what can it reach during the build?

*Stack-specific notes: `stacks/<stack>/ci-cd-and-secrets.md` for the detected stack, when present.*
