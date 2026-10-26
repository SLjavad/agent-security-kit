# .NET: lifecycle and servicing facts

Companion to `core/patching-cadence.md`. From Microsoft Learn ([releases and support](https://learn.microsoft.com/dotnet/core/releases-and-support), checked October 2026). Support dates change; re-read the page before relying on them.

## Facts
- Servicing updates ship monthly. Security fixes ship on patch Tuesday, the second Tuesday of the month. A servicing update is supported only until the next one ships, so only the latest servicing level is supported.
- Standard Term Support (STS) releases are supported for 24 months. Long Term Support (LTS) releases are supported for at least three years, or one year after the next LTS ships if later.
- Listed as supported at the time of checking: .NET 10 (LTS) until November 2028; .NET 9 (STS) until November 2026; .NET 8 (LTS) until November 2026.
- Out-of-support versions receive no security updates.
- The SDK can target all runtimes, so use the latest SDK even for an older runtime. Setting `CheckSdkVulnerabilities` to true makes the build warn (NETSDK1239) when the resolved SDK is end of life.
- Runtimes roll forward to the latest installed servicing update by default.
- .NET Framework follows the lifecycle of the Windows version it ships with; older 4.x releases have already ended support.

## Practice
- Pin the SDK with `global.json`; let base images carry the newest runtime patch.
- Rebuild images after each patch Tuesday (the official runtime and SDK images carry the fix).
- Track each project's `TargetFramework` in the inventory and put its end-of-support month in the calendar.
- Run `dotnet --list-runtimes` and `dotnet --list-sdks` on build and production hosts to confirm what is installed.

*Statements without a cited Learn page are general practice and were not fetched in this build.*
