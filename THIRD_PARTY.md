# Third-party sources

This kit does not contain third-party files. `tools/install.cjs` (through `tools/fetch-third-party.cjs`) downloads them from the sources below when you install. `third-party/lock.json` records, for each source, the commit that was reviewed (`reviewedSha`), the installed paths, and the trims and text patches applied after download.

Which commit is installed: the latest upstream commit when it passes the automatic check described in `README.md` ("Third-party versions"), otherwise the reviewed commit. `--pin-reviewed` always installs the reviewed commit. None of these repositories publishes tags or releases, so "latest" is the head of the default branch. The lock file refuses to load if a source's recorded review commit differs from its pinned fallback, so changing the fallback forces a fresh review.

| Id | Source | Licence | Reviewed commit | Installed as | Review (2026-10-26, Trail of Bits re-scoped 2026-10-27) |
|---|---|---|---|---|---|
| cloudflare-security-audit | https://github.com/cloudflare/security-audit-skill | MIT | `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` | `skills/security-audit` (tier 2 and 3 method) | partial: executables read, main files read, companion files pattern-scanned |
| agamm-owasp | https://github.com/agamm/claude-code-owasp | MIT | `8ac7965caa212b4a850aff8d3df0081ab3fa9eed` | `skills/owasp-security` | partial: all files pattern-scanned, no executables |
| trailofbits-skills | https://github.com/trailofbits/skills | CC-BY-SA-4.0 | `196a9073ab10d35bacf111f945e02c00b2c6883a` | Skills `differential-review`, `sharp-edges`, `audit-context-building`, `variant-analysis`, `fp-check`; six agents; `security-kb/third-party/insecure-defaults` (reference documents) | partial: executables read or pattern-scanned, main files read |

`partial` is used for everything: no source was read line by line. The full per-source scope and notes are in `third-party/lock.json` (`reviewScope`, `reviewNotes`).

## What the review covered

- **Pattern scan of all fetched files:** hidden or bidirectional Unicode, prompt-injection phrases, hidden HTML comments, exfiltration phrases, pipe-to-shell, reverse-shell and persistence patterns, credential paths, long encoded blobs, active SVG content, front-matter privilege keys, symlinks, binaries, and every URL domain.
- **Executables read:** Cloudflare's two validators; Trail of Bits' three workflow scripts (`variants.js`, `audit-context.js`, `audit.js`), shell scripts, and Python tests; agent and command files.
- **Skills read:** the Cloudflare and Trail of Bits main skill files and the OWASP skill layout.

## What it found

No malicious content: no hidden Unicode instructions, no exfiltration endpoints or paste or webhook domains, no binaries, no active SVG content, no symlinks. Findings worth knowing:

1. **Cloudflare validators cannot run on native Windows.** They refuse to read input unless `O_NOFOLLOW` and `O_NONBLOCK` exist; both are undefined in Node on Windows (checked on this machine), so the guard always fails. The skill requires both validators to pass, so full audits need WSL, Linux, or macOS. The validators themselves are read-only and use no network, environment variables, child processes, or writes.
2. **Trail of Bits `tests/eval.sh` runs `claude -p --permission-mode bypassPermissions`** against a cloned vulnerable checkout. It is a developer evaluation script and not part of using the skills. Tests and evals are not installed.
3. **Where Trail of Bits workflows write and read:** `audit-context.js` writes `audit-context/` into the working directory unless you pass `outDir`; `variants.js` falls back to listing directory names under your home folder; the `differential-review` skill may write reports to the working directory, the Desktop, or `~/.claude/skills/...`. The workflows themselves are not installed.
4. **`insecure-defaults` quotes matching lines into model context and its report** when run as its workflow. Only its reference documents are installed.
5. **Tool breadth in front matter:** the `differential-review` and `fp-check` skills declare Write and Bash (and Edit for `fp-check`) in `allowed-tools`. The agent trims in the lock file do not change what the skills themselves may do. The `function-analyzer` agent keeps its `Write` tool because it writes its analysis to disk.

## Changes applied after download

- Trail of Bits: only skill folders, six agent files, and the `insecure-defaults` reference documents are installed. Plugin manifests, commands, workflow scripts, hooks, tests, and evals are not installed, and each skill's `agents/` folder (an `openai.yaml` for another tool) is removed.
- Trail of Bits agents `adversarial-modeler` and `poc-builder`: the `tools` line is replaced by `Read, Grep, Glob`.
- Trail of Bits text patches (all in `third-party/lock.json`, each must match exactly once or the install falls back to the reviewed commit): namespaced agent names become bare names; the workflow-only routing in `audit-context-building` and `variant-analysis` becomes manual steps that need a plan table and a yes before subagents launch; `Workflow` is removed from the `audit-context-building` allowed tools; `{baseDir}` in one agent becomes a user path; `fp-check` no longer refers to "the plugin's" agents.
- Cloudflare: the two `*.test.cjs` files are removed.

After these changes the third-party executable code that ships is Cloudflare's two validators. Trail of Bits workflow scripts are not installed.

## Reviewed and not installed

Two further repositories were reviewed and are **not** installed: `mukul975/Anthropic-Cybersecurity-Skills` (Apache-2.0) and `Masriyan/Claude-Code-CyberSecurity-Skill` (MIT). Their topics were used as input for six documents written from scratch in `security-kb/core/` (CI security tooling, SBOMs and dependency scanning, container hardening, LLM and agent security, privacy requests, cryptography implementation); no text was copied. The review found no malicious content, but their skills carry unpinned install commands (including download-into-shell lines) and offensive reference material, which is why they are not shipped.

## Licence notes

- Trail of Bits material is CC-BY-SA-4.0. Private use is unaffected. If you redistribute the installed copies, share-alike and attribution apply, and the patched copies are adaptations. This repository contains none of its text.
- MIT sources (Cloudflare, OWASP) keep their licence files inside the installed folders.
- Windows Defender flagged one script in the Masriyan repository as malware earlier in this project (payload templates for security testing). It is not installed.

## Not copied

Microsoft Learn, OWASP, NIST, and regulator pages are cited by link in the reference documents. No text is copied from them.
