# agent-security-kit

A generic, project-independent and framework-independent security kit: a router skill, a read-only reviewer agent, a reference library, deterministic hooks, templates, and and tools that install well-known third-party security skills after an automatic safety check. It contains no facts about any particular project or organisation. Project specifics go in a private `.claude/security-context.md` per project (template included).

Status: early release. Built for Claude Code skills, agents, and hooks; the reference library is plain Markdown that any agent or person can read. Only the `dotnet` stack is written so far, and the kit has not yet been tested against live Claude Code sessions beyond the included unit tests. Installation is one command with a `--dry-run` preview, conflict checks, backups, and an uninstaller (see below).

## What is inside

| Path | Purpose |
|---|---|
| `skills/security-kit/` | Router skill: tiers, `/security-kit quick`, `/security-kit pr`, `/security-kit audit`, `/security-kit deep` |
| `agents/security-reviewer.md` | Read-only reviewer (Read, Grep, Glob) |
| `security-kb/core/` | 21 framework-neutral reference documents, including CI tooling, SBOMs, containers, LLM applications, privacy requests, cryptography implementation, and recent-advisory checks (see `security-kb/INDEX.md`) |
| `security-kb/stacks/` | One folder per language or framework with its specific notes, hook rules, and templates. `dotnet/` is complete; `_template/` and `stacks/README.md` explain how to add another |
| `security-kb/templates/` | Framework-neutral templates: project context, secret scanning configuration, CI secret-scan job |
| `hooks/security-kit/` | Zero-dependency Node hooks: shell guard, secret scan before writes, post-edit scan; core rules plus any `stacks/*/hook-rules.json`; tests included |
| `settings.patch.json` | Hook entries and `SECURITY_HOOKS_MODE=warn`, merged additively by `tools/merge-settings.cjs` |
| `tools/install.cjs` | Installer and uninstaller: `--dry-run` preview, conflict-safe, rollback on failure, manifest, smoke test |
| `tools/fetch-third-party.cjs` | Fetches third-party skills at the latest upstream commit that passes the automatic check (else the reviewed commit) and applies recorded trims and patches |
| `tools/merge-settings.cjs` | Dry-run-first merge and removal of the hook entries, with backup |
| `tools/prepublish-scan.cjs` | Scans this folder for secrets, personal paths, emails, internal hosts, and your own terms |
| `third-party/lock.json` | Sources, licences, the reviewed commit of each, review state, trims, patches |
| `THIRD_PARTY.md` | Sources, licences, and what is changed |

## Tiers

| Tier | When | Method |
|---|---|---|
| 0 | Always | Hooks, analyzers, NuGet audit |
| 1 | Every PR, and `/security-kit advisories` for recent CVEs and advisories affecting the project (live lookups after you approve the list of component names and versions sent) | `differential-review`, `owasp-security`, built-in `/security-review`, `security-reviewer` |
| 2 | Release or quarterly, explicit request only | `security-audit` (its validators need WSL, Linux, or macOS; they cannot run on native Windows), scoped by the project context |
| 3 | Only when triggered, explicit request only | Deep profile, native code, fuzzing, pentest preparation |

Tiers 2 and 3 never start on their own, and any subagent launch needs the user's approval after a plan table.

## Tests

```bash
node --test
```

Runs the hook, fetcher, scanner, settings-merge, and kit-lint tests. The lint tests enforce that framework-neutral files contain no stack vocabulary and that every stack folder follows the contract.

## Hooks

Hooks start in warn mode: they log findings and never block. Each project gets its own log, `~/.claude/hooks/security-kit/logs/<project-name>-<short-id>/findings.jsonl`. The project is the nearest parent folder containing `.git` (else the working directory), and the short id is a hash of its full path, so two projects with the same folder name stay apart; findings with no working directory go to `_unknown`. A line holds only the time, the hook, the rule name, and the file's base name, never matched text or paths. A log is renamed to `findings.1.jsonl` when it reaches 1 MB (one backup is kept, so a project uses at most about 2 MB). `SECURITY_HOOKS_LOG_DIR` moves the whole logs folder and `SECURITY_HOOKS_LOG_MAX_BYTES` changes the size limit. Switch to blocking by setting `SECURITY_HOOKS_MODE` to `enforce` in the settings `env` block. In enforce mode the pre-tool hooks exit with code 2 (blocking, with the reason on stderr) and the post-edit hook exits 2 to show its findings to Claude after the edit.

Not included yet: a gitleaks call inside the post-edit hook. gitleaks documents `gitleaks dir <path>` and `--redact`; add and test it after you install the tool.

## Installing

The installer is `tools/install.cjs`. It needs Node 18 or newer, git, and network access to GitHub for the third-party skills (use `--offline` to skip them). Running it installs the whole kit: there are no optional parts to forget. Add **`--dry-run`** to preview first: it prints every file it would create, update, or leave alone, the settings entries it would add, and any conflicts, and it changes nothing.

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
- Fetches the third-party skills listed in `third-party/lock.json` (security audit, OWASP, and the Trail of Bits review skills and agents) into `~/.claude/skills`, `agents`, and `security-kb/third-party`. See "Third-party versions" below.
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
| `--offline` | Skip the third-party downloads (install the kit's own files only) |
| `--pin-reviewed` | Install the exact commits that were reviewed instead of the latest upstream commit |
| `--verbose` | List every file |
| `--force` | Replace conflicting files after backing them up |
| `--no-smoke-test` | Skip the post-install checks |

Exit codes: 0 success, 1 error or failed smoke test, 2 conflicts (nothing changed).

The old `--with-third-party`, `--with-plugin-files`, `--with-curated`, and `--include-unreviewed` options were removed on purpose; the installer refuses them with a message.

### Third-party versions

None of the three upstream repositories publishes tags or releases, so "latest" means the head of its default branch. Installing whatever is there unchecked would let an upstream change alter your agent's instructions after you reviewed it, so the installer compares the head with the commit that was reviewed (`reviewedSha` in `third-party/lock.json`):

1. Head equals the reviewed commit: installed as is.
2. Head is newer: the installer fetches both and looks only at files under the installed paths (files the lock removes are ignored). The newer commit is installed only if every changed file is plain documentation (`.md`, `.mdx`, `.txt`, `.json`), nothing became executable or a symbolic link, the added lines contain no hidden Unicode, download-into-shell, instruction-override phrases, long encoded blobs, or changed `tools`/`allowed-tools`/`hooks` declarations, and every text patch in the lock still applies.
3. Anything else: the reviewed commit is installed and the dry run and the install output say why.

The dry run shows the decision for each source (`reviewed`, `latest`, or `reviewed-fallback`) before anything is written, and the manifest records the installed commit and the reviewed commit. The automatic check is not a review: a newer documentation change can still be wrong in ways a pattern check cannot see. Use `--pin-reviewed` for exactly the reviewed commits.

After installing, restart Claude Code sessions. Review the project logs under `~/.claude/hooks/security-kit/logs/` for a few days before choosing `enforce`.

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
