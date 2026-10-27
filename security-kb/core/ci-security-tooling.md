# Security tooling in CI

Own guidance, written from vendor documentation and OWASP material; nothing copied. This covers which automated checks to run, where, and how to install and tune them. The policy on dependencies is in `core/dependency-supply-chain.md`; the pipeline's own hardening is in `core/ci-cd-and-secrets.md`.

## What each kind of check finds
| Check | Finds | Does not find | Typical tools |
|---|---|---|---|
| Static analysis (SAST) | Injection sinks, unsafe APIs, weak crypto calls, tainted data reaching dangerous functions | Business-logic flaws, missing authorization, runtime configuration | Semgrep, CodeQL, the language's own analyzers |
| Secret scanning | Keys, tokens, passwords, private keys in files and history | Secrets stored elsewhere, weak passwords | gitleaks, trufflehog |
| Dependency scanning | Known-vulnerable packages and their versions | Malicious packages with no advisory, bugs in your code | OSV-Scanner, Trivy, the ecosystem's audit command |
| Infrastructure-as-code scanning | Open ports, public storage, privileged containers, missing encryption | Whether the deployed environment matches the code | Trivy config, Checkov, KICS |
| Container image scanning | Vulnerable OS packages and libraries inside an image | Misconfiguration at run time | Trivy, Grype |
| Dynamic testing (DAST) | Missing headers, reflected injection, exposed paths, weak TLS on a running instance | Anything behind a login it cannot reach, logic flaws | OWASP ZAP |

Every row has blind spots. Authorization, tenant isolation, and business logic need review and tests, not scanners.

## Where to run them
1. **Editor and pre-commit:** secret scan only. It is fast and stops the mistake before it enters history.
2. **Every merge request:** secret scan on the diff, SAST on changed files, dependency scan, IaC scan. Keep the total under a few minutes or people will bypass it.
3. **Main branch or nightly:** full-history secret scan, full SAST, image scan of the built image, SBOM generation (`core/sbom-and-dependency-scanning.md`).
4. **Against a deployed test environment, scheduled:** DAST baseline. Never against production without written approval, and never against a system you do not own.

## Installing the tools safely
- Do not pipe a download into a shell. Use the package manager, the vendor's signed release, or a container image pinned by digest.
- Pin the **tool version** and, for CI actions or templates, the **commit** or digest. A scanner that updates itself is a supply-chain entry point into your pipeline.
- Check the published checksum of any downloaded binary before running it.
- Update pinned tools on a schedule, with the rule database updated more often than the engine.
- On Windows runners prefer package-manager installs or container jobs; do not assume `sh`, `curl`, or `/tmp`.
- Give scanner jobs read-only access to the repository and no deployment credentials.

## Making results useful
- **Baseline once, then fail on new findings.** Record existing findings as a dated baseline and block only new ones, so the gate is enforceable on day one. Work the baseline down by severity.
- **Fail thresholds:** block on high and critical confirmed findings and on any verified secret; report the rest.
- **Suppress with a reason.** Every ignore entry names the rule, the file, the reason, an owner, and an expiry date. Review expiring entries each quarter.
- **Triage by reachability and exposure,** not by score alone: is the code reachable from an input, is the service internet-facing, is the data sensitive.
- **Use SARIF** where your platform supports it so findings appear on the change.
- **A leaked secret is revoked first,** then removed from the code. Rewriting history does not un-leak it.
- **Measure:** time to fix, new findings per release, and false-positive rate. A rule with a high false-positive rate is tuned or removed; an ignored rule is worse than none.

## Questions to ask
- Which of the six checks do we run, and which risks does that leave uncovered?
- Are tool versions and actions pinned, and who updates them?
- Does a failed scan block the merge, or only report?
- Who owns triage, and what is the target time to fix a high finding?

*Stack-specific notes: `stacks/<stack>/ci-security-tooling.md` for the detected stack, when present.*
