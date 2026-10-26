# .NET: NuGet supply chain

Companion to `core/dependency-supply-chain.md`. Checked against Microsoft Learn in October 2026. Feature availability depends on the SDK: `dotnet list package --vulnerable` from the .NET 5 SDK (5.0.200); NuGetAudit from the .NET 8 SDK; audit sources from the .NET 9 SDK; transitive auditing is the default for projects targeting net10.0 and higher, and `direct` otherwise ([auditing packages](https://learn.microsoft.com/nuget/concepts/auditing-packages)). Name the SDK version you are advising for.

## Vulnerabilities
- NuGetAudit warns during restore: NU1901 low, NU1902 moderate, NU1903 high, NU1904 critical. NU1900 means the vulnerability data could not be fetched, so a clean restore proves nothing then. NU1905 means an audit source provides no vulnerability data.
- NuGetAudit needs a source that supplies a vulnerability database. If nuget.org is not a package source, add it as an audit source. `https://data.nuget.org/v3/index.json` serves vulnerability data only, which suits networks that block the full API.
- Properties: `NuGetAudit` (default true), `NuGetAuditMode` (`direct` or `all`), `NuGetAuditLevel` (default low). Set them in `Directory.Build.props` (`templates/Directory.Build.props`).
- Fail CI on high and critical by treating NU1903 and NU1904 as errors (`WarningsAsErrors`).
- Report with `dotnet list package --vulnerable --include-transitive`; transitive packages are excluded without that flag. From SDK 9.0.300 the command uses `auditSources`.

## Dependency confusion: package source mapping
- Use package source mapping in a repository-level `nuget.config`. Once a `packageSourceMapping` section exists, every package, including transitive ones, must match a pattern ([package source mapping](https://learn.microsoft.com/nuget/consume-packages/package-source-mapping)). Template: `templates/nuget.config`.
- Map your own prefix to the private feed only and `*` to the public feed. The most specific pattern wins, so internal ids never resolve from the public feed.
- Learn's caveats: mapping applies only to restore, install, and update downloads. `dotnet list package --outdated/--deprecated/--vulnerable` and `dotnet package add` query metadata and send package ids to all configured sources, so internal package names can reach public feeds through those commands.
- If a package is already in the global packages folder, no source lookup happens and mappings are ignored. Declare a repository-specific global packages folder for the full benefit.
- The `NuGet.PackageSourceMapper` tool can generate a starting `nuget.config` from a successful restore.

## Repeatable restores
- Enable lock files with `RestorePackagesWithLockFile` and restore with `--locked-mode` (`RestoreLockedMode`) in CI ([package references](https://learn.microsoft.com/nuget/consume-packages/package-references-in-project-files)).
- Commit the lock file for applications and executables. Do not commit it for libraries you do not ship: consumers do not use a dependency's lock file.
- NU1403 (content hash mismatch) means the package differs from the last restore. Treat it as possible tampering until the source is identified ([NU1403](https://learn.microsoft.com/nuget/reference/errors-and-warnings/nu1403)).
- Floating versions such as `2.*` are repeatable only with lock files. Pin the SDK with `global.json`, because implicit package versions change with it.

## Review and provenance
- Check a package's publisher, release history, repository, licence, and transitive count before adding it.
- Verify signatures and configure `trustedSigners` where policy requires it ([nuget.config reference](https://learn.microsoft.com/nuget/reference/nuget-config-file)). Store no credentials in `nuget.config`; use the CI credential provider.
- Produce an SBOM at release.

## Checklist
- [ ] Repository-root `nuget.config` with explicit sources and `packageSourceMapping`
- [ ] `auditSources` set when the private feed has no vulnerability data
- [ ] NuGetAudit on, mode `all`, NU1903 and NU1904 fail CI
- [ ] Lock files committed for applications; `--locked-mode` in CI
- [ ] `global.json` pins the SDK

*Statements without a cited Learn page are general practice and were not fetched in this build.*
