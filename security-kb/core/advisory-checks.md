# Checking a project against recent advisories and CVEs

Own guidance, written from the OSV, CISA, and GitHub advisory documentation; nothing copied. A language model does not know advisories published after its training, and the kit's documents are static. This document defines how to get current answers for a project while it is being developed: run on request (`/security-kit advisories`), before a release, and when a change touches dependency lock files or runtime versions. Nothing here runs on a timer or launches agents by itself.

## What is checked
1. **Libraries** the project depends on, direct and transitive, at the exact versions in the lock files.
2. **Runtimes and languages** the project runs on (for example the interpreter or virtual machine version).
3. **Base images and operating-system packages** in container files.
4. **Servers and services** named in compose files, infrastructure code, and CI images (databases, proxies, queues).
5. **Build and CI components:** pinned actions, templates, and tool versions.

A vulnerability in a runtime is about the version you run, not your source code. Look it up by version, not by searching the code.

## Procedure
1. **Inventory (read-only).** Detect the stacks (`skills/security-kit/SKILL.md`). Collect, with file and line for each:
   - runtime and language versions from version files and manifests (for example `.tool-versions`, `.nvmrc`, `.python-version`, build-image tags, CI image tags);
   - resolved package versions from lock files, not version ranges from manifests;
   - base image names and tags or digests from container files;
   - services and their versions from compose files and infrastructure code.
2. **Decide what may leave the machine.** Lookups need component names and versions only. Never send source code, file paths, host names, repository names, or the names of private or internal packages (anything resolved from a private registry). Show the user the exact list that will be looked up, name the services that will receive it, and wait for a yes.
3. **Look up current data** from primary sources, in this order of preference:
   - a scanner already installed on the machine (for example OSV-Scanner or the ecosystem's audit command) run against the lock files; say which database it queried and when it was last updated;
   - the OSV database, the GitHub Advisory Database, and the national vulnerability database for the exact package and version;
   - CISA's Known Exploited Vulnerabilities catalogue, to mark which matches are being exploited;
   - the vendor's or project's own security announcements for runtimes, servers, and operating-system packages (the stack's `advisorySources` in `stack.json` lists them), and the distribution's security tracker for packages inside images, because distributions backport fixes without changing the upstream version number;
   - the end-of-support dates for the runtime (`core/patching-cadence.md`).
   A search-engine snippet or a blog is a pointer, not a source: open the advisory itself and read the affected and fixed version ranges.
4. **Match precisely.** Compare the installed version with the affected range quoted from the source. Deduplicate aliases (CVE, GHSA, vendor IDs) into one finding. A distribution package at a patched build is not affected even if its upstream version number looks old. If a range cannot be read or compared, mark the finding `could not verify` and say why. Do not guess.
5. **Filter for what is new.** Report two lists: all open matches, and matches published in the requested window (`--since <date>`, default the last 90 days). Always give the publication date.
6. **Triage each match** with the questions in `core/sbom-and-dependency-scanning.md`: is the component in the shipped artifact or only a tool; is the vulnerable function or configuration reachable from an input (use call tracing, not a keyword search); is the service exposed; is it listed as exploited; is a fixed version available and how large is the upgrade; is there a configuration mitigation.
7. **Offer follow-up, never apply it.** Propose the version bump or mitigation as a change for the user to approve. For a bug class that could also exist in the project's own code, offer the `variant-analysis` skill with the advisory's root cause, only on a yes.

## Report format
One table, sorted by priority (exploited first, then reachable and exposed, then the rest):

| ID and aliases | Component and where found | Installed | Fixed in | Published | Severity, exploited? | Reachable? | Action | Source |
|---|---|---|---|---|---|---|---|---|

- Reachable is one of: confirmed (with the call path), not reachable (with why), needs validation (with the exact missing fact).
- End with: which sources were queried and on what date, what could not be checked, and which inventory items were skipped (for example private packages).
- Never write "no vulnerabilities". Write "no matches in the sources checked on <date>".

## Limits to state in every report
- Advisories not yet published, and vulnerabilities nobody has found, are invisible to this check.
- Private and internal components are not covered.
- Scanner and database coverage differ by ecosystem and lag the disclosure; two sources catch more than one.
- Nothing runs between development sessions. For projects that are idle for long periods, ask the team to run this before they resume work or ship.
- Severity scores are a starting point. Reachability and exposure decide urgency.

## Questions to ask
- Which runtime and base-image versions do we actually deploy, and when were they last checked?
- Which advisories in the last 90 days touch components we ship?
- Which of those are reachable, and which are listed as exploited?

*Stack-specific notes: `stacks/<stack>/advisory-checks.md` for the detected stack, when present.*
