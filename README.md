# agent-security-kit

A generic, project-independent and framework-independent security kit: a router skill, a read-only reviewer agent, a reference library, deterministic hooks, templates, and tools that fetch well-known third-party security skills at pinned commits. It contains no facts about any particular project or organisation. Project specifics go in a private `.claude/security-context.md` per project (template included).

Status: early release. Built for Claude Code skills, agents, and hooks; the reference library is plain Markdown that any agent or person can read. Only the `dotnet` stack is written so far, and the kit has not yet been tested against live Claude Code sessions beyond the included unit tests. Installation is one command with a `--dry-run` preview, conflict checks, backups, and an uninstaller (see below).

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
| `tools/install.cjs` | Installer and uninstaller: `--dry-run` preview, conflict-safe, rollback on failure, manifest, smoke test |
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

## Installing

The installer is `tools/install.cjs`. It needs Node 18 or newer and git (only for third-party fetching). Running it installs the kit. Add **`--dry-run`** to preview first: it prints every file it would create, update, or leave alone, the settings entries it would add, and any conflicts, and it changes nothing.

Preview:

```bash
node tools/install.cjs --dry-run
```

Install:

```bash
node tools/install.cjs
```

What a real install does:

- Copies the router skill, reviewer agent, `security-kb/`, and the hooks (without tests or logs) into `~/.claude`.
- Merges the hook entries and `SECURITY_HOOKS_MODE` into `~/.claude/settings.json`, keeping everything already there and writing a `settings.json.bak-<time>` backup first.
- Records every installed file with its hash in `~/.claude/.agent-security-kit-manifest.json`.
- Runs a smoke test against the installed hooks and reports each check.

Safety rules:

- A file that already exists and was not installed by this kit, or that you edited after installing, is a **conflict**. Nothing at all is written until you resolve it or pass `--force`, which backs the file up to `~/.claude/.agent-security-kit-backup-<time>/` first.
- Everything is checked before the first write. If copying fails part way, the files written so far are rolled back.
- Running it again is safe: unchanged files are skipped, unmodified files are updated, and files removed from the kit are removed.

Options:

| Option | Meaning |
|---|---|
| `--dry-run` | Preview only: list what would happen and change nothing |
| `--claude-dir <dir>` | Install somewhere other than `~/.claude` (useful for trying it out) |
| `--hooks-mode warn|enforce` | Hook mode written to settings (default `warn`) |
| `--node-command <path>` | Command used to start the hooks, for example an absolute path to node (default `node`) |
| `--no-settings` | Copy files only; do not touch `settings.json` |
| `--with-third-party` | Also fetch the reviewed third-party skills at pinned commits into `skills/` (needs network and git) |
| `--include-unreviewed` | With third-party: also fetch the curated reference skills whose review state is `none`. Read them first (`security-kb/core/ai-tooling-security.md`) |
| `--with-plugin-files` | With third-party: also fetch the Trail of Bits plugin folders into `plugins-local/`. Activating a plugin is a manual step; confirm the install command for your Claude Code version first |
| `--verbose` | List every file |
| `--force` | Replace conflicting files after backing them up |
| `--no-smoke-test` | Skip the post-install checks |

Exit codes: 0 success, 1 error or failed smoke test, 2 conflicts (nothing changed).

After installing, restart Claude Code sessions. Review `~/.claude/hooks/security/logs/findings.jsonl` for a few days before choosing `enforce`.

### Uninstalling

```bash
node tools/install.cjs --uninstall --dry-run   # preview
node tools/install.cjs --uninstall             # remove
```

Removes only files whose content still matches the manifest (files you edited are kept unless you add `--force`), removes the kit's settings entries, and copies everything it removes to a backup folder first.

### Lower-level tools

`tools/fetch-third-party.cjs` and `tools/merge-settings.cjs` can be run on their own; the installer uses both.

## Before publishing this folder

```bash
node tools/prepublish-scan.cjs --terms path/to/your-private-terms.txt
```

Keep the terms file (internal names you must never publish) outside the repository. Choose and add your own licence file. Do not commit `dist/`. Review `THIRD_PARTY.md`: this repository references third-party work and does not redistribute it.

## Limits

- Intrusion detection, live traffic monitoring, and penetration testing of running systems are operational work; this kit gives checklists, not detection.
- AI review does not replace a human penetration test for systems that handle money or identity.
- Stack documents cite their sources and the date they were checked, and mark statements without a fetched source as general practice. Re-check version-specific statements for your target version. Only the `dotnet` stack is populated so far; other stacks need the same research before they are added.
