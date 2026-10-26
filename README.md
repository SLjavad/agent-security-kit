# agent-security-kit

A generic, project-independent and framework-independent security kit: a router skill, a read-only reviewer agent, a reference library, deterministic hooks, templates, and tools that fetch well-known third-party security skills at pinned commits. It contains no facts about any particular project or organisation. Project specifics go in a private `.claude/security-context.md` per project (template included).

Status: early release. Built for Claude Code skills, agents, and hooks; the reference library is plain Markdown that any agent or person can read. Only the `dotnet` stack is written so far, and the kit has not yet been tested against live Claude Code sessions beyond the included unit tests. Installation is manual and dry-run first (see below); nothing is installed automatically.

## What is inside

| Path | Purpose |
|---|---|
| `skills/security/` | Router skill: tiers, `/security quick`, `/security pr`, `/security audit`, `/security deep` |
| `agents/security-reviewer.md` | Read-only reviewer (Read, Grep, Glob) |
| `security-kb/core/` | 14 framework-neutral reference documents (see `security-kb/INDEX.md`) |
| `security-kb/stacks/` | One folder per language or framework with its specific notes, hook rules, and templates. `dotnet/` is complete; `_template/` and `stacks/README.md` explain how to add another |
| `security-kb/templates/` | Framework-neutral templates: project context, secret scanning configuration, CI secret-scan job |
| `hooks/security/` | Zero-dependency Node hooks: shell guard, secret scan before writes, post-edit scan; core rules plus any `stacks/*/hook-rules.json`; tests included |
| `settings.patch.json` | Hook entries and `SECURITY_HOOKS_MODE=warn`, merged additively by `tools/merge-settings.cjs` |
| `tools/fetch-third-party.cjs` | Fetches third-party skills at pinned SHAs and applies recorded trims |
| `tools/merge-settings.cjs` | Dry-run-first merge and removal of the hook entries, with backup |
| `tools/prepublish-scan.cjs` | Scans this folder for secrets, personal paths, emails, internal hosts, and your own terms |
| `third-party/lock.json` | Pinned sources, licences, review state, patches |
| `THIRD_PARTY.md` | Sources, licences, and what is changed |

## Tiers

| Tier | When | Method |
|---|---|---|
| 0 | Always | Hooks, analyzers, NuGet audit |
| 1 | Every PR | `differential-review`, `owasp-security`, built-in `/security-review`, `security-reviewer` |
| 2 | Release or quarterly, explicit request only | `security-audit`, scoped by the project context |
| 3 | Only when triggered, explicit request only | Deep profile, native code, fuzzing, pentest preparation |

Tiers 2 and 3 never start on their own, and any subagent launch needs the user's approval after a plan table.

## Tests

```bash
node --test
```

Runs the hook, fetcher, scanner, settings-merge, and kit-lint tests. The lint tests enforce that framework-neutral files contain no stack vocabulary and that every stack folder follows the contract.

## Hooks

Hooks start in warn mode: they log the rule name and file name to `~/.claude/hooks/security/logs/findings.jsonl` and never block. They never record matched text. Switch to blocking by setting `SECURITY_HOOKS_MODE` to `enforce` in the settings `env` block. In enforce mode the pre-tool hooks exit with code 2 (blocking, with the reason on stderr) and the post-edit hook exits 2 to show its findings to Claude after the edit.

Not included yet: a gitleaks call inside the post-edit hook. gitleaks documents `gitleaks dir <path>` and `--redact`; add and test it after you install the tool.

## Installing (needs your approval at each step; nothing here has been run)

1. Fetch third-party skills into a build folder, not into this repository:
   ```bash
   node tools/fetch-third-party.cjs --target dist            # dry run
   node tools/fetch-third-party.cjs --target dist --apply
   ```
   Sources whose review state is `none` are skipped unless you add `--include-unreviewed`. Read each one first using the procedure in `security-kb/core/ai-tooling-security.md`.
2. Copy into `~/.claude`: `skills/security`, `dist/skills/*`, `agents/security-reviewer.md`, `security-kb` (plus `dist/security-kb/curated` if you fetched it), and `hooks/security`.
3. Merge the hooks, dry run first. The kit directory is the folder that contains `hooks/security`:
   ```bash
   node tools/merge-settings.cjs --settings ~/.claude/settings.json --kit-dir ~/.claude
   node tools/merge-settings.cjs --settings ~/.claude/settings.json --kit-dir ~/.claude --apply
   ```
   If the exec-form `node` command does not start on your machine, put the absolute path of `node` in the patch.
4. Optional Trail of Bits plugins (`dist/plugins-local/*`): confirm the local plugin install mechanism for your Claude Code version first; the plugin READMEs suggest `/plugin install <path>`.
5. Restart sessions. Review `findings.jsonl` for a few days before choosing `enforce`.

Uninstall: `node tools/merge-settings.cjs --settings ~/.claude/settings.json --remove --apply`, then delete the copied folders. Backups are written next to `settings.json` as `.bak-<timestamp>`.

## Before publishing this folder

```bash
node tools/prepublish-scan.cjs --terms path/to/your-private-terms.txt
```

Keep the terms file (internal names you must never publish) outside the repository. Choose and add your own licence file. Do not commit `dist/`. Review `THIRD_PARTY.md`: this repository references third-party work and does not redistribute it.

## Limits

- Intrusion detection, live traffic monitoring, and penetration testing of running systems are operational work; this kit gives checklists, not detection.
- AI review does not replace a human penetration test for systems that handle money or identity.
- Stack documents cite their sources and the date they were checked, and mark statements without a fetched source as general practice. Re-check version-specific statements for your target version. Only the `dotnet` stack is populated so far; other stacks need the same research before they are added.
