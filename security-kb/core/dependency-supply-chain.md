# Dependency supply chain

Applies to any package ecosystem. Items marked (general practice) are not from a fetched source. Package-manager commands, file names, and settings are in the stack documents.

## Threats
- **Known-vulnerable packages**, direct and transitive.
- **Dependency confusion**: a public package with the same name as an internal one is chosen by the resolver.
- **Typosquatting and malicious packages**, including install-time scripts and build plug-ins.
- **Tampering between registry and build**: the package fetched today differs from yesterday's.
- **Abandoned packages** with nobody left to patch them.
- **Compromised maintainer or build pipeline** upstream.

## 1. Know about vulnerabilities
- Use your ecosystem's audit mechanism and run it in CI as well as on developer machines. Include transitive dependencies; direct-only reports miss most of the tree.
- Confirm the vulnerability data source is actually reachable and configured for every registry you use, including private ones. An audit that could not fetch data must not be read as "clean". (general practice)
- Fail the build on high and critical findings. Warnings nobody reads protect nothing.
- Give advisory alerts an owner and a response time by severity.

## 2. Stop dependency confusion
- Map each internal package namespace or prefix to your private registry only, and everything else to the public one, using your package manager's source or scope mapping feature.
- Prefer one registry that proxies the public one for packages you consume, if your organisation runs it. (general practice)
- Treat internal package names as disclosed if metadata commands are run against public registries: some tools send package names to every configured source.

## 3. Make installs repeatable
- Use lock files and install from them in CI (a frozen or locked mode that fails if they are out of date).
- Verify content hashes where the ecosystem supports it. A hash mismatch is possible tampering until proven otherwise.
- Avoid floating version ranges in applications unless lock files are enforced.
- Commit lock files for applications and deployable services. For libraries that others consume, follow the ecosystem's convention; locks usually do not apply to consumers.
- Pin the toolchain version (compiler, SDK, package manager) so implicit dependencies do not change silently.

## 4. Review what you add
Before adding a package: who publishes it, last release date, release history, repository link, licence, number of transitive dependencies, install-time scripts or plug-ins, and whether the platform already provides the feature. Check the exact name for typos against the project's own documentation. (general practice)

## 5. Provenance and inventory
- Verify package signatures or provenance attestations where your ecosystem and policy support them.
- Produce a software bill of materials at release so you can answer "are we affected?" quickly when a new advisory appears. (general practice)

## Checklist
- [ ] Audit runs in CI over the full dependency tree, with data sources configured for every registry
- [ ] High and critical findings fail the build
- [ ] Internal names resolve only from the private registry
- [ ] Lock files committed for applications; CI installs in locked mode
- [ ] No credentials stored in package manager configuration files
- [ ] A named owner reviews new dependencies and advisory alerts

*Stack-specific notes: `stacks/<stack>/dependency-supply-chain.md` for the detected stack, when present.*
