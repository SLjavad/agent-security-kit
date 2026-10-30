# Adding a stack

A stack is one language, framework, or platform (for example `dotnet`, `react`). It adds facts that are specific to it. It never changes the framework-neutral documents in `security-kb/core/`, the router skill, or the installer.

This guide is for people who add a stack to the kit. It lives in the repository only; the installer does not copy it. The short contract is also in `security-kb/stacks/README.md`, which is installed.

## 1. Before you start

- Node 18 or newer and git. Run `node --test` once; it must pass before you change anything.
- Pick the id: lowercase, letters, digits, and `-`, the same as the folder name (`react`, `django`, `spring-boot`). One stack per ecosystem. Do not mix a language and a framework in one folder unless people always use them together.
- Read one finished stack, `security-kb/stacks/dotnet/`, to see the tone: short documents, each fact with a source link, statements without a source labelled as general practice.

## 2. What you create

All new files go in `security-kb/stacks/<id>/`. Nothing else is required.

| File | Required | What it holds |
|---|---|---|
| `stack.json` | yes | Metadata, see the table below |
| `<topic>.md` | one per entry in `docs` | Stack-specific notes for one core topic. The file name is the core document's name |
| `README.md` | recommended | Scope, versions covered, how it was researched, what is not covered |
| `hook-rules.json` | optional | Extra checks the post-edit hook runs on files in this stack |
| `templates/` | optional | Configuration snippets or CI jobs; every one is listed in `stack.json` |

### `stack.json`

```json
{
  "id": "react",
  "name": "React (browser front end)",
  "detect": ["*.jsx", "*.tsx"],
  "authoritativeSources": [{ "name": "React documentation", "how": "Fetch react.dev for the version in use" }],
  "advisorySources": [{ "name": "GitHub Advisory Database, npm", "url": "https://github.com/advisories?query=ecosystem%3Anpm" }],
  "verified": "2026-10",
  "docs": ["dependency-supply-chain"],
  "templates": []
}
```

| Field | Rule (the lint tests enforce it) |
|---|---|
| `id` | Equals the folder name |
| `name` | Non-empty text |
| `detect` | Non-empty list of file-name patterns such as `*.csproj`. The router looks for them up to five folders deep, skipping `node_modules`, `bin`, `obj`, `dist`, and `.git`. Patterns match file names only, never file contents, so pick distinctive files and say in the README what else they also match |
| `authoritativeSources` | A list (may be empty): where an agent should look up facts about this stack, and how |
| `advisorySources` | Required, may be empty. Each entry has `name` and an `https` `url`: where this stack's runtime, framework, and package advisories are published |
| `verified` | `YYYY-MM`, the month you checked the facts. `tools/check-updates.cjs` reports a stack older than 6 months |
| `docs` | Non-empty. Each name must be a file in `security-kb/core/` (without `.md`) and you must write `<name>.md` in your folder |
| `templates` | Optional. Each file must exist in `templates/` |

Every `.md` in the folder other than `README.md` must be listed in `docs`.

## 3. Writing a topic document

1. Name it exactly like the core document it extends (`injection-deserialization-memory.md`). The first four lines must contain the core document in backticks, for example "Companion to `core/dependency-supply-chain.md`."
2. In the opening paragraph give the versions you checked and the month.
3. Add only what is specific to the stack. Do not repeat the core checklist.
4. Cite a primary source for every fact: the vendor's documentation first, then the package manager's documentation, then widely used guidance such as OWASP or MDN. Fetch the page; do not write from memory. Do not copy their text: paraphrase, and quote at most a short phrase.
5. Label anything you could not source as general practice. End the file with: `*Statements without a cited ... page are general practice and were not fetched in this build.*`
6. Keep it short, around 25 to 45 lines. A reader should find the stack's traps in a minute.
7. Good topics to start with, in order: `dependency-supply-chain`, `injection-deserialization-memory`, `authz-and-tenant-isolation`, `crypto-and-data-protection`, `ci-cd-and-secrets`. Add others when the stack has real, specific content for them. Skip a topic rather than write filler.

Never put stack vocabulary into the neutral files (`core/`, `INDEX.md`, `skills/`, `agents/`, `security-kb/templates/`). A lint test fails if it finds any of the words listed in `STACK_VOCABULARY` (step 5).

## 4. Hook rules (optional)

`hook-rules.json` adds deterministic checks to the post-edit hook. The hook reads every stack folder when it runs, so there is nothing to register. The hook does not read `detect`: a rule applies to every file whose path matches `files`, in any project. Make `files` as narrow as the stack allows. If the extension is shared with other stacks (`.js`, `.ts`), add `requires` to the rule, for example `"requires": { "file": "package.json", "regex": "\"react\"\\s*:" }`. The rule then fires only when that file, in the edited file's folder or a parent up to the git root, matches. With no such file anywhere on that path the rule still fires, so a missing manifest does not silence a check. A rule may also carry `"mode": "warn"`: it is logged but never blocks, even when the user sets enforce mode. Use it for patterns that also match legitimate code; any other value for `mode` makes the hook drop the rule.

```json
{
  "configDrift": [
    { "id": "react-eval", "files": "\\.(?:jsx?|tsx?)$", "regex": "\\beval\\s*\\(" }
  ]
}
```

- A simple rule has `id`, `files` (a regular expression tested against the whole path), `regex`, and optional `flags`.
- A structured rule counts matches inside a block: `extract` (first group is the block), `count`, `min`, and optional `absent` (a pattern that must not match anywhere in the file). See `security-kb/stacks/dotnet/hook-rules.json` for `nuget-multiple-sources-without-mapping`.
- Rules report their `id` only, never the matched text. Choose ids that name the problem.
- The hook scans the whole file after an edit, so a rule fires on every later edit of a file that already matches. Prefer patterns that are almost always a real problem, and avoid expressions that can backtrack badly: they run on every edit.
- Files named `*.example.*`, `*.sample.*`, `*.template.*` are skipped by name.

## 5. Files you change

| File | Change | Why |
|---|---|---|
| `security-kb/stacks/README.md` | Add a row to "Stacks included" | The installed list of stacks |
| `README.md` | Update the places that say which stacks exist ("Only the ... stack", the `security-kb/stacks/` row, the Limits bullet) | Honest status |
| `tools/kit-lint.test.cjs` | Add your stack's vocabulary to `STACK_VOCABULARY` (for example `/\bReact\b/`) | Keeps the neutral files neutral from now on |
| `hooks/security-kit/hooks.test.cjs` | If you wrote hook rules: one test that each rule fires on a bad sample and stays quiet on a good one | Rules are code and need a test |
| `tools/check-updates.cjs` | Only if a template pins a container image by digest: add the template file to `PINS`. Only if the stack has version-specific dates (like the .NET support dates): add a check | A lint test fails when a pinned image is not watched |

You do not change: the installer (it copies the whole `security-kb/` folder), `skills/security-kit/SKILL.md` (stack detection reads `stack.json`), `security-kb/INDEX.md` (it lists core documents only), `settings.patch.json`, `third-party/lock.json`.

## 6. Templates (optional)

Put them in `templates/` and list each in `stack.json`. A CI job that uses an image must pin it by digest (`name:tag@sha256:...`). A placeholder is allowed only if it contains `REPLACE-WITH` and the first lines of the file say "Replace REPLACE-WITH...". Do not put secrets, real host names, or personal paths in a template.

## 7. Check your work

```bash
node --test
node tools/prepublish-scan.cjs
node tools/check-updates.cjs --only stacks
node tools/install.cjs --dry-run --claude-dir <an empty folder>
```

- `node --test` must report no failures. It checks the contract, the neutral vocabulary, hook rule syntax, and the CI templates.
- The scan must be clean: no personal paths, addresses, or secrets in your files.
- The update check must list your stack as `ok`.
- The dry run must list your new files as `create`.

## 8. Done checklist

- [ ] Every fact has a fetched source link or the general-practice label
- [ ] `verified` is the month you checked
- [ ] `detect` patterns are distinctive and the README says what else they match
- [ ] No stack words in neutral files; `STACK_VOCABULARY` updated
- [ ] Hook rules have tests; templates are listed and contain no secrets
- [ ] `README.md` and `security-kb/stacks/README.md` list the stack
- [ ] `node --test` and the prepublish scan pass
- [ ] You wrote what is not covered in the stack README

## Common mistakes

- Copying a whole vendor page into a document. Paraphrase and link.
- Writing version-specific claims without naming the version.
- Repeating the core checklist instead of adding stack facts.
- Detect patterns that match many ecosystems (`package.json`, `*.json`), which makes the router apply the stack to projects that do not use it.
- A hook rule that fires on code that is normally fine, which teaches people to ignore the log.
