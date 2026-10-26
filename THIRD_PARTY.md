# Third-party sources

This kit does not contain third-party files. `tools/fetch-third-party.cjs` and `tools/install.cjs --with-third-party` fetch them at the commits pinned in `third-party/lock.json`. Never track a branch. The lock file refuses to load if a source's recorded review commit (`reviewedSha`) differs from its pin, so changing a pin forces a fresh review.

| Id | Source | Licence | Pinned commit | Used for | Review (2026-10-26) | Install |
|---|---|---|---|---|---|---|
| cloudflare-security-audit | https://github.com/cloudflare/security-audit-skill | MIT | `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` | `skills/security-audit` (tier 2 and 3 method) | partial: executables read, main files read, companion files pattern-scanned | with `--with-third-party` |
| agamm-owasp | https://github.com/agamm/claude-code-owasp | MIT | `8ac7965caa212b4a850aff8d3df0081ab3fa9eed` | `skills/owasp-security` | partial: all files pattern-scanned, no executables | with `--with-third-party` |
| trailofbits-skills | https://github.com/trailofbits/skills | CC-BY-SA-4.0 | `196a9073ab10d35bacf111f945e02c00b2c6883a` | Plugins: differential-review, insecure-defaults, sharp-edges, audit-context-building, variant-analysis, fp-check | partial: executables read or pattern-scanned, main files read | files only with `--with-plugin-files`; activation is manual |
| mukul975-curated | https://github.com/mukul975/Anthropic-Cybersecurity-Skills | Apache-2.0 | `54a798831d2266a3ca61ce68a7acb80b81160d57` | 30 reference skills under `security-kb/curated/` | partial: all files pattern-scanned, all SKILL.md summarised, 2 read in full | optional: `--with-curated` |
| masriyan-curated | https://github.com/Masriyan/Claude-Code-CyberSecurity-Skill | MIT (its NOTICE requires attribution in redistributions) | `3aa77d84fb64cf07b550f6be4544bb91292db89f` | Skills 09, 13, 19, 20 as reference material | partial: all files pattern-scanned, all SKILL.md summarised, 09 read in full | optional: `--with-curated` |

`partial` is used for everything: no source was read line by line. The full per-source scope and notes are in `third-party/lock.json` (`reviewScope`, `reviewNotes`).

## What the review covered

- **Pattern scan of all 353 fetched files:** hidden or bidirectional Unicode, prompt-injection phrases, hidden HTML comments, exfiltration phrases, pipe-to-shell, reverse-shell and persistence patterns, credential paths, long encoded blobs, active SVG content, front-matter privilege keys, symlinks, binaries, and every URL domain.
- **Executables read:** Cloudflare's two validators; Trail of Bits' three workflow scripts (`variants.js`, `audit-context.js`, `audit.js`), shell scripts, and Python tests; agent and command files.
- **Skills read:** all 38 curated `SKILL.md` files summarised (4 artifact-signing skills were dropped afterwards, leaving 34) (description, sections, every instruction line outside code); `auditing-mcp-servers-for-tool-poisoning` and `09-web-security` read in full; all 34 mukul975 licence files compared (identical Apache-2.0 text).

## What it found

No malicious content: no hidden Unicode instructions, no exfiltration endpoints or paste or webhook domains, no binaries, no active SVG content, no symlinks. The two prompt-injection phrases and the zero-width character set are defensive examples inside prompt-injection skills. Findings worth knowing:

1. **Cloudflare validators cannot run on native Windows.** They refuse to read input unless `O_NOFOLLOW` and `O_NONBLOCK` exist; both are undefined in Node on Windows (checked on this machine), so the guard always fails. The skill requires both validators to pass, so full audits need WSL, Linux, or macOS. The validators themselves are read-only and use no network, environment variables, child processes, or writes.
2. **Trail of Bits `tests/eval.sh` runs `claude -p --permission-mode bypassPermissions`** against a cloned vulnerable checkout. It is a developer evaluation script and not part of using the plugin, so all `tests/` and `evals/` folders are removed on install.
3. **Where Trail of Bits workflows write and read:** `audit-context.js` writes `audit-context/` into the working directory (inside the audited repository) unless you pass `outDir`; `variants.js` falls back to listing directory names under your home folder to locate its reference files; the `differential-review` skill may write reports to the working directory, the Desktop, or `~/.claude/skills/...`.
4. **`insecure-defaults` quotes matching lines into model context and its report.** Those lines can contain literal credentials from configuration files. Run it only where that is acceptable.
5. **Tool breadth in front matter:** the `differential-review` and `fp-check` skills declare Write and Bash (and Edit for `fp-check`) in `allowed-tools`. The agent trims in the lock file do not change what the skills themselves may do.
6. **Curated skills give unpinned install instructions:** 6 pipe-to-shell lines in 4 skills (the kit's shell guard blocks these in enforce mode), and 20 `@latest`, 33 `pip install`, 13 `uvx`, and 8 `go install ...@` commands. Use the vendor's verified install method and pin versions, as `security-kb/core/dependency-supply-chain.md` advises.
7. **Curated skills mention files that are not installed.** `scripts/` is removed, so about 19 skills point at scripts that are absent. Treat those mentions as descriptions only.
8. **Quality varies:** six curated crypto skills are short generic outlines of 3 to 4 KB.
9. **`09-web-security` is offensive reference material** (SQL injection, XSS, template injection, command injection, SSRF, and JWT attack payloads) under authorization notices. Use it only for authorised testing, which this kit treats as tier 3.

## Changes applied after fetching

- Trail of Bits `fp-check`: the `hooks/` directory is removed, so its Stop-hook prompts are not installed.
- Trail of Bits `differential-review` agent `adversarial-modeler` and `fp-check` agent `poc-builder`: the `tools` line is replaced by `Read, Grep, Glob`.
- Trail of Bits: the `tests/` and `evals/` folders of `audit-context-building`, `insecure-defaults`, and `variant-analysis` are removed.
- Cloudflare: the two `*.test.cjs` files are removed.
- Curated mukul975 and Masriyan skills: each `scripts/` directory is removed; only instruction files and references are kept.

After these changes the third-party executable code that ships is: Cloudflare's two validators and Trail of Bits' three workflow scripts.

## Licence notes

- Trail of Bits material is CC-BY-SA-4.0. Private use is unaffected. If you redistribute adapted text, share-alike and attribution apply. The patched copies are adaptations.
- Apache-2.0 requires keeping the licence and any notices when you redistribute. Each fetched mukul975 skill keeps its own `LICENSE` file.
- The Masriyan project asks that copies keep its copyright notice, `LICENSE`, and `NOTICE`. Do not redistribute fetched files without them.
- Windows Defender flagged one script in the Masriyan repository as malware earlier in this project (payload templates for security testing). Scripts are excluded here. The remaining `examples/` files were pattern-scanned with no findings.

## Not copied

Microsoft Learn and OWASP pages are cited by link in the reference documents. No text is copied from them.
