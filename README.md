# agent-security-kit

A generic, project-independent and framework-independent security kit: a router skill, a read-only reviewer agent, a reference library, deterministic hooks, templates, and tools that install well-known third-party security skills after an automatic safety check. It contains no facts about any particular project or organisation. Project specifics go in a private `.claude/security-context.md` per project (template included).

Status: early release. Built for Claude Code skills, agents, and hooks; the reference library is plain Markdown that any agent or person can read. Two stacks are written so far, `dotnet` and `react` (browser side). The hooks were checked in a live headless Claude Code session on Windows in warn mode (hook start, payload field names, findings); enforce mode is covered by unit tests only, and the GitLab jobs were run in their scanner images but not in a real pipeline. Installation is one command with a `--dry-run` preview, conflict checks, backups, and an uninstaller (see below).

## What is inside

| Path | Purpose |
|---|---|
| `skills/security-kit/` | Router skill: tiers, `/security-kit quick`, `/security-kit pr`, `/security-kit advisories`, `/security-kit audit`, `/security-kit deep` |
| `agents/security-reviewer.md` | Read-only reviewer (Read, Grep, Glob) |
| `security-kb/core/` | 21 framework-neutral reference documents, including CI tooling, SBOMs, containers, LLM applications, privacy requests, cryptography implementation, and recent-advisory checks (see `security-kb/INDEX.md`) |
| `security-kb/stacks/` | One folder per language or framework with its specific notes, hook rules, and templates. `dotnet/` is complete and `react/` covers the browser side; `_template/`, `stacks/README.md`, and `docs/adding-a-stack.md` explain how to add another |
| `security-kb/templates/` | Framework-neutral templates: project context, secret scanning configuration, a Renovate starting configuration for dependency updates, and CI secret-scan and advisory-scan jobs (run against the pinned scanner images; the `dotnet` stack adds its own variants) |
| `hooks/security-kit/` | Zero-dependency Node hooks: shell guard, secret scan before writes, post-edit scan; core rules plus any `stacks/*/hook-rules.json`; tests included |
| `settings.patch.json` | Hook entries and `SECURITY_HOOKS_MODE=warn`, merged additively by `tools/merge-settings.cjs` |
| `tools/install.cjs` | Installer and uninstaller: `--dry-run` preview, conflict-safe, rollback on failure, manifest, smoke test |
| `tools/fetch-third-party.cjs` | Fetches third-party skills at the reviewed commit (or, with `--latest`, a newer upstream commit that passes the automatic check) and applies recorded trims and patches |
| `tools/merge-settings.cjs` | Dry-run-first merge and removal of the hook entries, with backup |
| `tools/prepublish-scan.cjs` | Scans this folder for secrets, personal paths, emails, internal hosts, and your own terms |
| `tools/check-updates.cjs` | Read-only update check: third-party skills against upstream, .NET support dates and SDK against Microsoft's release feed, the age of each stack's verified date, and the pinned osv-scanner, gitleaks, and `actions/checkout` tags against their latest releases |
| `.github/workflows/check-updates.yml` | Weekly run of the update check; opens or updates one issue when something needs review and closes it when nothing does |
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

Runs the hook, installer, fetcher, scanner, settings-merge, and kit-lint tests. The lint tests enforce that framework-neutral files contain no stack vocabulary and that every stack folder follows the contract.

## Hooks

Hooks start in warn mode: they log findings and never block. Each project gets its own log, `~/.claude/hooks/security-kit/logs/<project-name>-<short-id>/findings.jsonl`. The project is the nearest parent folder containing `.git` (else the working directory), and the short id is a hash of its full path, so two projects with the same folder name stay apart; findings with no working directory go to `_unknown`. A line holds only the time, the hook, the rule name, and the file's base name, never matched text or paths. A log is renamed to `findings.1.jsonl` when it reaches 1 MB (one backup is kept, so a project uses at most about 2 MB). `SECURITY_HOOKS_LOG_DIR` moves the whole logs folder and `SECURITY_HOOKS_LOG_MAX_BYTES` changes the size limit. Switch to blocking by setting `SECURITY_HOOKS_MODE` to `enforce` in the settings `env` block. In enforce mode the pre-tool hooks exit with code 2 (blocking, with the reason on stderr) and the post-edit hook exits 2 to show its findings to Claude after the edit.

The shell guard checks what the shell will run (not the tool's `description` text) against its shell rules and the secret patterns, so a key typed into a command is caught as well as one written to a file. For commands the connection-string password rule is stricter than for files: a password key inside a connection string is caught, while a prefixed environment variable (for example the SQL Server container password variable set in a `docker run`) is not, because those are routine in local development. `cp .env.example .env` is allowed; reading or copying `.env` itself is not. Name rules (`.example`, `.sample`, `.template`) exempt a file by its own name only, never because of a folder name.

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
- If the third-party download fails, files already updated or removed are restored from the backup and settings are left untouched.
- An install made when the skill was still named `security` is migrated: its old files and hook entries are replaced by the `security-kit` ones. The old `hooks/security/logs` folder is left alone.

Options:

| Option | Meaning |
|---|---|
| `--dry-run` | Preview only: list what would happen and change nothing |
| `--claude-dir <dir>` | Install somewhere other than `~/.claude` (useful for trying it out) |
| `--hooks-mode <warn or enforce>` | Hook mode written to settings (default `warn`). On a later run an existing mode is kept unless you pass this option, which changes it |
| `--node-command <path>` | Command used to start the hooks, for example an absolute path to node (default `node`). On a later run existing hook entries keep their command unless you pass this option, which rewrites it in place |
| `--no-settings` | Copy files only; do not touch `settings.json` |
| `--offline` | Skip the third-party downloads (install the kit's own files only) |
| `--pin-reviewed` | Install the exact commits that were reviewed. This is the default; the flag is accepted for clarity |
| `--latest` | Take the newest upstream commit of each third-party source when it passes the automatic check (see "Third-party versions"), instead of the reviewed commit |
| `--verbose` | List every file |
| `--force` | Replace conflicting files after backing them up |
| `--no-smoke-test` | Skip the post-install checks |

Exit codes: 0 success, 1 error or failed smoke test, 2 conflicts (nothing changed).

The old `--with-third-party`, `--with-plugin-files`, `--with-curated`, and `--include-unreviewed` options were removed on purpose; the installer refuses them with a message.

### Third-party versions

By default the installer installs exactly the commit that was reviewed (`reviewedSha` in `third-party/lock.json`). The kit's own guidance (`security-kb/core/ai-tooling-security.md`) says to pin commits, because an upstream change can alter your agent's instructions after you reviewed them. Pass `--latest` to take newer upstream commits instead.

None of the three upstream repositories publishes tags or releases, so "latest" means the head of its default branch. With `--latest` the installer compares the head with the reviewed commit:

1. Head equals the reviewed commit: installed as is.
2. Head is newer: the installer fetches both and looks only at files under the installed paths (files the lock removes are ignored). The newer commit is installed only if every changed file is plain documentation (`.md`, `.mdx`, `.txt`, `.json`), nothing became executable or a symbolic link, the added lines contain no hidden Unicode, download-into-shell, instruction-override phrases, long encoded blobs, or changed `tools`/`allowed-tools`/`hooks` declarations, A text patch from the lock that no longer applies is caught at install time, and the reviewed commit is installed instead.
3. Anything else: the reviewed commit is installed and the dry run and the install output say why.

The dry run shows the decision for each source (`reviewed`, `latest`, or `reviewed-fallback`) before anything is written, and the manifest records the installed commit and the reviewed commit. The automatic check is not a review: a newer documentation change can still be wrong in ways a pattern check cannot see, which is why `--latest` is opt-in. Review the dry-run output before using it.

### Permissions the third-party skills ask for

Some installed third-party skills declare `allowed-tools` in their front matter, which lets the skill use those tools while it is active. Two are broader than a review needs, and the agent trims in `third-party/lock.json` do not change them:

| Skill | Declared tools | Breadth |
|---|---|---|
| `differential-review` | Read, Write, Grep, Glob, Bash | Can write files (its reports) and run shell commands |
| `fp-check` | Read, Grep, Glob, LSP, Bash, Task, Write, Edit, AskUserQuestion, and the task tools | Can edit files and run shell commands (it builds proof-of-concept exploits) |
| `sharp-edges`, `audit-context-building` | Read, Grep, Glob (the latter also Task) | Read-only apart from launching subagents |

Check your own permission rules before you run these two on a project you care about: `deny` and `ask` rules in `settings.json` still apply and are the place to limit them, and the kit's shell guard hook still sees every Bash call they make. The `function-analyzer` agent also keeps `Write` because it writes its analysis to disk. If you want a stricter set, edit the front matter of the installed skill; the next install then reports that folder as a conflict and changes nothing until you resolve it or pass `--force`, and an uninstall keeps it as modified.

After installing, restart Claude Code sessions. Review the project logs under `~/.claude/hooks/security-kit/logs/` for a few days before choosing `enforce`.

### Uninstalling

```bash
node tools/install.cjs --uninstall --dry-run   # preview
node tools/install.cjs --uninstall             # remove
```

Removes only files whose content still matches the manifest (files you edited are kept unless you add `--force`), removes the kit's settings entries, and copies everything it removes to a backup folder first.

### Update checks

Two parts keep the pinned things from going stale. Neither changes anything on its own: the check produces a report or an issue for a person to review. (Dependabot is not used: its docker ecosystem reads Dockerfiles and manifests, not CI template files, so its runs on the template folders failed.)

- `tools/check-updates.cjs` compares each third-party source with its upstream and says whether the gate would accept the change, checks the support dates in `patching-cadence.md` and the SDK version noted in the dependency-audit template against Microsoft's release feed, flags a stack whose `verified` month is more than 6 months old, and compares the tags pinned in the CI templates (osv-scanner, gitleaks) and in the workflow (`actions/checkout`) with each project's latest GitHub release. Only the tag is compared: when one moves, read its release notes, wait a few days, then refresh the tag and the digest together by hand. A moved third-party commit is never installed by this check: read the diff, then move `sha` and `reviewedSha` together in `third-party/lock.json`.
- `security-kb/templates/renovate.json` is a starting point for a project hosted on GitLab: Renovate's `config:best-practices` preset plus a 7-day minimum release age, with no automerge.

```bash
node tools/check-updates.cjs [--only third-party,dotnet,stacks,pins] [--max-age-months 6]
```

It prints a markdown report. Exit code 0 means nothing needs review, 1 that a check could not run, 2 that something needs review, 3 both. `.github/workflows/check-updates.yml` runs it every Monday and keeps one open issue in step with the result.

### Lower-level tools

`tools/fetch-third-party.cjs`, `tools/merge-settings.cjs` and `tools/check-updates.cjs` can be run on their own; the installer uses the first two.

## Before publishing this folder

```bash
node tools/prepublish-scan.cjs --terms path/to/your-private-terms.txt
```

Keep the terms file (internal names you must never publish) outside the repository. The kit is MIT licensed (`LICENSE`). Do not commit `dist/`. Review `THIRD_PARTY.md`: this repository references third-party work and does not redistribute it.

## Limits

- **Overlapping triggers.** The installed `owasp-security`, `security-audit`, and `differential-review` skills have their own descriptions that also match "security review". The router's description asks to be used first and its "Routing among security skills" section restates the tier rules, but which skill starts first is the model's choice and the kit cannot force it. The installed third-party descriptions are not patched.
- **The weekly workflow has not been seen running on GitHub yet.** It was written from GitHub's workflow syntax; `tools/check-updates.cjs` is tested and was run live. Watch the first Monday run (or start it by hand with "Run workflow") before relying on it.
- Intrusion detection, live traffic monitoring, and penetration testing of running systems are operational work; this kit gives checklists, not detection.
- AI review does not replace a human penetration test for systems that handle money or identity.
- Stack documents cite their sources and the date they were checked, and mark statements without a fetched source as general practice. Re-check version-specific statements for your target version. Only the `dotnet` and `react` stacks are populated so far; other stacks need the same research before they are added (see `docs/adding-a-stack.md`).
