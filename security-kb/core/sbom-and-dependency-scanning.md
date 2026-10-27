# SBOMs and dependency scanning in practice

Own guidance, written from the CycloneDX, SPDX, and OSV project documentation and CISA material; nothing copied. `core/dependency-supply-chain.md` sets the policy (sources, pinning, lock files, review). This document is the workflow: produce an inventory, match it against advisories, and decide what to do.

## Terms
- **SBOM (software bill of materials):** a machine-readable list of the components in a build, with versions and where they came from. Formats: CycloneDX and SPDX.
- **Advisory database:** published vulnerability records. OSV, the GitHub Advisory Database, and the national database each cover different ecosystems and lag differently.
- **VEX (vulnerability exploitability exchange):** a statement that a listed vulnerability does or does not affect your product, with a reason. It records "not affected" decisions so they are not re-triaged every scan.
- **Transitive dependency:** a package your package pulls in. Most findings are here.

## Workflow
1. **Generate the SBOM from the built artifact or the resolved lock file,** not from the manifest alone. A manifest lists ranges; the lock file and the build list what actually shipped. Tools: Syft, cdxgen, or the ecosystem's own CycloneDX plugin.
2. **Include every layer.** Application packages, the base image's OS packages, and anything copied in by hand (vendored libraries, bundled binaries).
3. **Store it with the release,** keyed by version or image digest, for as long as the release can be running. When a new advisory appears you need to answer "are we affected" without rebuilding.
4. **Match against advisories** with at least one scanner that reads the SBOM or lock file (OSV-Scanner, Grype, Trivy). Running two with different databases catches more; reconcile their differences instead of ignoring them.
5. **Triage each finding** (below), then fix, mitigate, or record a VEX decision.
6. **Re-scan stored SBOMs on a schedule,** because new advisories arrive after release.

## Triage
For every finding answer, in order:
1. Is the vulnerable component actually in the shipped artifact, or only in a build or test tool?
2. Is the vulnerable function reachable from an input we accept?
3. Is the affected service exposed to untrusted users, and does it hold sensitive data?
4. Is a fixed version available, and is the upgrade a patch, a minor, or a breaking change?
5. If we cannot upgrade now: is there a configuration mitigation, a compensating control, or a feature we can disable?

Record the result as: fix scheduled (with date), mitigated (with how), or not affected (with reason, as a VEX statement). "Unknown" is not a result.

## Targets
- A critical finding that is reachable and exposed is fixed or mitigated within days, not at the next release.
- Fixes for build and test tooling follow the normal cadence.
- No finding is closed without a recorded reason.

## Licence checking
Scan the same SBOM for licences. Decide in advance which licences are allowed, which need review (strong copyleft in distributed software, network copyleft in hosted software), and which are blocked. Unknown or missing licences need a human decision.

## Pitfalls
- Scanning the manifest only and missing transitive packages.
- Scanning the source tree but not the final image, so base-image packages are never checked.
- An SBOM generated once and never stored, so incident questions need a rebuild.
- Treating a scanner's severity as the answer. Severity is a starting point; reachability and exposure decide urgency.
- Malicious packages usually have no advisory. Scanning does not replace the controls in `core/dependency-supply-chain.md`.

*Stack-specific notes: `stacks/<stack>/sbom-and-dependency-scanning.md` for the detected stack, when present.*
