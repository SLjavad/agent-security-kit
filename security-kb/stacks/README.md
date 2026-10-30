# Stacks

The documents in `core/` are independent of language and framework. Everything that depends on a language, framework, package manager, or platform lives in its own folder here, one folder per stack.

## How a stack is used

1. The router skill looks for each stack's `detect` file patterns in the project (up to five directory levels deep, skipping `node_modules`, `bin`, `obj`, `dist`, and `.git`).
2. For a topic, read `core/<topic>.md` first, then `stacks/<id>/<topic>.md` for every detected stack, if that file exists.
3. The stack's `hook-rules.json` adds deterministic checks to the post-edit hook automatically.
4. A stack may list authoritative sources in `stack.json` (for example a vendor documentation server). Use them for facts about that stack, and name the version.
5. A stack may list `advisorySources` in `stack.json`: where that stack's runtime, framework, and package advisories are published. `/security-kit advisories` consults them (see `core/advisory-checks.md`).

A project can match several stacks (for example a .NET API and a Node front end). Use all that match.

## Contract for a stack folder

```
stacks/<id>/
  stack.json          required: id, name, detect, authoritativeSources, verified, docs; optional: advisorySources (list of { name, url }), templates
  README.md           optional: scope, versions covered, how it was researched
  <topic>.md          one per topic in `docs`; the file name equals a file in core/
  hook-rules.json     optional: extra configDrift rules (see below)
  templates/          optional: configuration snippets for this stack
```

- `id` matches the folder name. Folders starting with `_` or `.` are ignored by the hooks and the router; `_template` is a starting point.
- A stack document starts with a line naming the core document it extends, states the versions it was checked against and the date, and cites its sources. Statements without a cited source are labelled as general practice.
- A stack document adds only what is specific to the stack. It does not repeat the core checklist.
- `hook-rules.json` holds `configDrift` rules. A simple rule has `id`, `files` (a regular expression matched against the path), `regex`, and optional `flags`. A structured rule has `id`, `files`, `extract` (a regular expression whose first group is the block to inspect), `count` (a regular expression counted inside that block), `min`, and optionally `absent` (a regular expression that must not match anywhere in the file). Either kind may carry `requires` (`{ "file": "package.json", "regex": "..." }`): the rule then applies only if a file of that plain name, in the edited file's folder or any parent up to the git root, matches the regex. If no such file exists anywhere on that path, the rule applies. Either kind may also carry `"mode": "warn"`: the rule is logged but never blocks in enforce mode. Rules report a rule id only, never the matched text.

## Stacks included

| Folder | Status |
|---|---|
| `dotnet/` | Complete: 10 topic documents, templates, hook rules. Checked against Microsoft Learn in October 2026 |
| `react/` | Browser side of React: 10 topic documents, 2 templates, 7 hook rules. Checked against the React, Node.js, npm, Vite, MDN, and OWASP documentation in October 2026 (React 19). React Native and server-side framework details are not covered |

## Adding a stack

Copy `_template/`, rename it, and fill it in from the stack's vendor documentation, its package manager's security documentation, and its community security guidance (for example its official security advisories and widely used linters). Keep each document short. Run `node --test` from the kit root: the lint tests check the contract. The full step-by-step guide, with the list of files to change, is `docs/adding-a-stack.md` in the kit repository (it is not installed).
