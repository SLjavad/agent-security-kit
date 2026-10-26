# Patching cadence

Applies to any stack. Release schedules, support dates, and tooling are stack-specific; take them from the stack document and the vendor's current lifecycle page, never from memory. Items marked (general practice) are not from a fetched source.

## What to do
1. **Inventory.** List each service, its language runtime and framework version, base image, operating system, and where it runs. You cannot patch what you cannot list. (general practice)
2. **Know the vendor cadence.** Find when security updates ship for each runtime and framework you use, and how long each version is supported. Write the dates down.
3. **Monthly routine.** After each vendor release day: read release notes for security fixes, rebuild images from the new base, rebuild and redeploy, and record the date. Automate the rebuild.
4. **End-of-support calendar.** Put each version's end date in the team calendar six months ahead. Upgrades take longer than planned.
5. **Pin the toolchain, not the patch level.** Pin compiler and SDK versions so builds are reproducible, and let base images carry the newest runtime patch.
6. **Container base images.** Rebuild on schedule even when your code did not change; the base image carries the fix. Use tags you can trace, and prefer digests for release builds.
7. **Operating system and database.** Treat OS, database, and proxy patches on the same calendar. Each has its own lifecycle.
8. **Third-party packages.** See `dependency-supply-chain.md`. Alerts need an owner and a response time by severity, for example critical in days and high in weeks. Choose numbers you will actually meet.
9. **Triage a CVE.** Is the vulnerable code reachable in your configuration? Which services use the affected version? Is a mitigation available while patching? Record the decision, even when the answer is "not affected".

## Signals that the process is failing
- A service runs a version with less than six months of support left and has no upgrade ticket.
- Images older than the last vendor release day are running.
- Nobody can say which services use a given package version.

*Stack-specific notes: `stacks/<stack>/patching-cadence.md` for the detected stack, when present.*
