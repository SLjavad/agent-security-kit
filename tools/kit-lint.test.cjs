const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const kb = path.join(root, 'security-kb')
const coreDir = path.join(kb, 'core')
const stacksDir = path.join(kb, 'stacks')

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8')
const mdFiles = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.md'))
const stacks = fs.readdirSync(stacksDir, { withFileTypes: true }).filter((e) => e.isDirectory() && !/^[_.]/.test(e.name)).map((e) => e.name)
const coreDocs = mdFiles(coreDir).map((f) => f.replace(/\.md$/, ''))

const STACK_VOCABULARY = [/\.NET\b/, /\bNuGet\b/i, /ASP\.NET/, /EF Core|Entity Framework/, /\bC#/, /csproj|\.sln\b/, /Kestrel/, /Roslyn/, /\bdotnet\b/i, /Microsoft Learn/, /\bLINQ\b/, /Blazor/, /Razor/]

const neutralFiles = () => [
  ...coreDocs.map((d) => path.join(coreDir, `${d}.md`)),
  path.join(root, 'skills', 'security-kit', 'SKILL.md'),
  path.join(root, 'agents', 'security-reviewer.md'),
  path.join(kb, 'INDEX.md'),
  ...fs.readdirSync(path.join(kb, 'templates')).map((f) => path.join(kb, 'templates', f))
]

test('there are core documents and at least one stack', () => {
  assert.ok(coreDocs.length >= 14)
  assert.ok(stacks.length >= 1)
})

test('framework-neutral files contain no stack-specific vocabulary', () => {
  const hits = []
  for (const file of neutralFiles()) {
    const text = fs.readFileSync(file, 'utf8')
    for (const re of STACK_VOCABULARY) if (re.test(text)) hits.push(`${path.relative(root, file)}: ${re}`)
  }
  assert.deepStrictEqual(hits, [])
})

test('every core document ends with its stack pointer', () => {
  for (const doc of coreDocs) {
    const lines = read(coreDir, `${doc}.md`).trimEnd().split(/\r?\n/)
    assert.strictEqual(lines[lines.length - 1], `*Stack-specific notes: \`stacks/<stack>/${doc}.md\` for the detected stack, when present.*`, doc)
  }
})

test('the index lists every core document and every linked path exists', () => {
  const index = read(kb, 'INDEX.md')
  for (const doc of coreDocs) assert.ok(index.includes(`core/${doc}.md`), `INDEX missing ${doc}`)
  const links = [...index.matchAll(/`((?:core|stacks|templates)\/[^`]+)`/g)].map((m) => m[1]).filter((p) => !p.includes('<'))
  assert.ok(links.length > 0)
  for (const link of links) assert.ok(fs.existsSync(path.join(kb, link)), `INDEX links to missing ${link}`)
})

test('each stack folder satisfies the contract', () => {
  for (const id of stacks) {
    const dir = path.join(stacksDir, id)
    const meta = JSON.parse(read(dir, 'stack.json'))
    assert.strictEqual(meta.id, id)
    assert.ok(typeof meta.name === 'string' && meta.name.length > 0, `${id}: name`)
    assert.ok(Array.isArray(meta.detect) && meta.detect.length > 0 && meta.detect.every((d) => typeof d === 'string'), `${id}: detect`)
    assert.match(meta.verified, /^\d{4}-\d{2}$/, `${id}: verified`)
    assert.ok(Array.isArray(meta.authoritativeSources), `${id}: authoritativeSources`)
    for (const s of meta.advisorySources || []) assert.ok(typeof s.name === 'string' && /^https:\/\//.test(s.url), `${id}: advisorySources entries need name and an https url`)
    assert.ok(Array.isArray(meta.docs) && meta.docs.length > 0, `${id}: docs`)
    for (const doc of meta.docs) {
      assert.ok(coreDocs.includes(doc), `${id}: ${doc} has no core document`)
      const text = read(dir, `${doc}.md`)
      assert.ok(text.split(/\r?\n/).slice(0, 4).join('\n').includes(`\`core/${doc}.md\``), `${id}/${doc}: first lines must name the core document`)
    }
    for (const doc of mdFiles(dir).map((f) => f.replace(/\.md$/, ''))) {
      if (doc === 'README') continue
      assert.ok(meta.docs.includes(doc), `${id}: ${doc}.md is not listed in stack.json`)
    }
    for (const t of meta.templates || []) assert.ok(fs.existsSync(path.join(dir, 'templates', t)), `${id}: template ${t}`)
  }
})

test('stack hook rules are well formed and compile', () => {
  for (const id of stacks) {
    const file = path.join(stacksDir, id, 'hook-rules.json')
    if (!fs.existsSync(file)) continue
    for (const rule of JSON.parse(read(file)).configDrift) {
      assert.ok(rule.id && rule.files, `${id}: rule needs id and files`)
      assert.ok(rule.regex || rule.count, `${id}/${rule.id}: needs regex or count`)
      for (const key of ['files', 'regex', 'extract', 'count', 'absent']) if (rule[key]) assert.doesNotThrow(() => new RegExp(rule[key]), `${id}/${rule.id}.${key}`)
    }
  }
})

test('the stack template is present and the router explains stack detection', () => {
  assert.ok(fs.existsSync(path.join(stacksDir, '_template', 'stack.json')))
  const router = read(root, 'skills', 'security-kit', 'SKILL.md')
  assert.match(router, /stack\.json/)
  assert.match(router, /detect/)
})

test('the advisories command is wired: router, core document, stack sources, and no scheduled trigger', () => {
  const router = read(root, 'skills', 'security-kit', 'SKILL.md')
  assert.match(router, /\/security-kit advisories/)
  assert.match(router, /core\/advisory-checks\.md/)
  assert.ok(coreDocs.includes('advisory-checks'))
  assert.ok(stacks.every((id) => JSON.parse(read(stacksDir, id, 'stack.json')).advisorySources !== undefined), 'every stack declares advisorySources')
  const template = read(kb, 'templates', 'gitlab-ci-advisory-scan.yml')
  assert.ok(!/\$CI_PIPELINE_SOURCE == "schedule"/.test(template))
})

test('advisory scan templates pin the scanner image, call its real binary path, and cover .NET dependency files', () => {
  const generic = read(kb, 'templates', 'gitlab-ci-advisory-scan.yml')
  const dotnet = read(stacksDir, 'dotnet', 'templates', 'gitlab-ci-advisory-scan.yml')
  for (const template of [generic, dotnet]) {
    assert.match(template, /ghcr\.io\/google\/osv-scanner:v\d+\.\d+\.\d+@sha256:[0-9a-f]{64}/)
    assert.ok(!/REPLACE-WITH/.test(template))
    assert.match(template, /^\s+- \/osv-scanner scan|^\s+\/osv-scanner scan/m)
    assert.ok(!/^\s+(- )?osv-scanner /m.test(template), 'the binary is not on PATH once the entrypoint is cleared')
    assert.match(template, /-eq 128/)
  }
  for (const glob of ['**/packages.lock.json', '**/packages.config']) assert.ok(generic.includes(glob), `generic template misses ${glob}`)
  for (const glob of ['**/packages.lock.json', '**/*.csproj', '**/Directory.Packages.props']) assert.ok(dotnet.includes(glob), `dotnet template misses ${glob}`)
  assert.ok(!/\$CI_PIPELINE_SOURCE == "schedule"/.test(dotnet))
})

test('the secret-scan template pins the tested scanner image', () => {
  const template = read(kb, 'templates', 'gitlab-ci-secret-scan.yml')
  assert.match(template, /ghcr\.io\/gitleaks\/gitleaks:v\d+\.\d+\.\d+@sha256:[0-9a-f]{64}/)
  assert.ok(!/REPLACE-WITH/.test(template))
  assert.match(template, /gitleaks git --redact --exit-code 1/)
})

test('the skill and hooks folders are named security-kit, and the logs live under the same name', () => {
  const skill = read(root, 'skills', 'security-kit', 'SKILL.md')
  assert.match(skill, /^---\r?\nname: security-kit\r?\n/)
  assert.ok(!fs.existsSync(path.join(root, 'skills', 'security')) && !fs.existsSync(path.join(root, 'hooks', 'security')))
  assert.ok(fs.existsSync(path.join(root, 'hooks', 'security-kit', 'lib.cjs')))
  assert.match(read(root, 'hooks', 'security-kit', 'lib.cjs'), /'hooks', 'security-kit', 'logs'/)
  assert.ok(!/\/security (quick|pr|advisories|audit|deep)/.test(skill), 'commands use the /security-kit prefix')
})

test('the router names every skill the lock file installs and says how to route among them', () => {
  const router = read(root, 'skills', 'security-kit', 'SKILL.md')
  const lock = JSON.parse(read(root, 'third-party', 'lock.json'))
  const skills = lock.sources.flatMap((s) => s.include.map((i) => i.to)).filter((to) => /^skills\/[^/]+$/.test(to)).map((to) => to.slice('skills/'.length))
  assert.ok(skills.length >= 7)
  for (const name of skills) assert.ok(router.includes(`\`${name}\``), `router does not mention ${name}`)
  assert.match(router, /## Routing among security skills/)
  assert.match(read(root, 'README.md'), /Overlapping triggers/)
})

const frontMatter = (text) => Object.fromEntries((text.match(/^---\r?\n([\s\S]*?)\r?\n---/) || [, ''])[1].split(/\r?\n/).filter((l) => /^[\w-]+:/.test(l)).map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]))

test('the router skill front matter is valid and its command table matches the argument hint', () => {
  const text = read(root, 'skills', 'security-kit', 'SKILL.md')
  const meta = frontMatter(text)
  assert.strictEqual(meta.name, 'security-kit')
  assert.ok(meta.description && meta.description.length <= 1024, `description is ${(meta.description || '').length} characters, the limit is 1024`)
  const hint = (meta['argument-hint'].match(/\[([a-z|]+)\]/) || [])[1]
  assert.ok(hint, 'argument-hint lists the commands')
  for (const command of hint.split('|')) {
    assert.ok(text.includes(`\`/security-kit ${command}`), `the command table lacks ${command}`)
    assert.ok(meta.description.includes(`/security-kit ${command}`), `the description lacks ${command}`)
  }
})

test('the reviewer agent stays read-only and every doc the router points to exists', () => {
  const agent = frontMatter(read(root, 'agents', 'security-reviewer.md'))
  assert.strictEqual(agent.name, 'security-reviewer')
  assert.deepStrictEqual(agent.tools.split(/,\s*/).sort(), ['Glob', 'Grep', 'Read'])
  const router = read(root, 'skills', 'security-kit', 'SKILL.md')
  for (const m of router.matchAll(/`((?:security-kb\/)?(?:core|templates|stacks)\/[A-Za-z0-9_.\/<>-]+\.(?:md|yml|json))`/g)) {
    if (m[1].includes('<')) continue
    assert.ok(fs.existsSync(path.join(kb, m[1].replace(/^security-kb\//, ''))), `router points to missing ${m[1]}`)
  }
})

test('every hook pattern compiles, ids are unique, and shell and unless expressions are valid', () => {
  const patterns = JSON.parse(read(root, 'hooks', 'security-kit', 'patterns.json'))
  const ids = []
  for (const group of ['secrets', 'bash', 'configDrift']) {
    for (const rule of patterns[group]) {
      ids.push(rule.id)
      for (const key of ['regex', 'shellRegex', 'unless', 'files']) if (rule[key]) assert.doesNotThrow(() => new RegExp(rule[key], rule.flags || ''), `${rule.id}.${key}`)
    }
  }
  assert.strictEqual(new Set(ids).size, ids.length, 'rule ids are unique')
  for (const key of ['excludeNames', 'excludePaths']) for (const p of patterns[key]) assert.doesNotThrow(() => new RegExp(p, 'i'), key)
  for (const rule of patterns.secrets.filter((r) => r.shellRegex)) assert.ok(rule.regex, `${rule.id} keeps its content regex`)
})

test('CI templates leave no image unpinned unless it is a marked placeholder with instructions', () => {
  const files = []
  const collect = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) collect(path.join(dir, e.name))
      else if (/\.ya?ml$/.test(e.name)) files.push(path.join(dir, e.name))
    }
  }
  collect(path.join(kb, 'templates'))
  collect(stacksDir)
  assert.ok(files.length >= 4)
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8')
    const images = [...text.matchAll(/^\s*image:\s*(\S+)\s*$|^\s*name:\s*(\S+@\S+|\S*:\S+)\s*$/gm)].map((m) => m[1] || m[2])
    for (const image of images) {
      if (/@sha256:[0-9a-f]{64}$/.test(image)) continue
      assert.match(image, /REPLACE-WITH/, `${path.relative(root, file)}: ${image} is neither pinned by digest nor a placeholder`)
      assert.match(text.split(/\r?\n/).slice(0, 3).join('\n'), /Replace REPLACE-WITH/, `${path.relative(root, file)}: placeholder needs instructions in the first lines`)
    }
  }
})

test('the dependency audit job fails on high or critical findings and on unreadable vulnerability data', () => {
  const job = read(stacksDir, 'dotnet', 'templates', 'gitlab-ci-dependency-audit.yml')
  assert.match(job, /^\s*image: mcr\.microsoft\.com\/dotnet\/sdk:\S+@sha256:[0-9a-f]{64}\s*$/m, 'the SDK image is pinned by digest')
  assert.match(job, /--format json > vulnerable-packages\.json/)
  assert.match(job, /grep -Eq '"severity": \*"\(High\|Critical\)"' vulnerable-packages\.json; then .*exit 1/)
  assert.match(job, /grep -q '"problems"' vulnerable-packages\.json; then .*exit 1/)
  assert.doesNotMatch(job, /vulnerability data could not be read/i, 'a problems entry is a project-level error, not specifically a data-source failure')
})

test('the secret-scan template tells how to use the kit allowlist', () => {
  const template = read(kb, 'templates', 'gitlab-ci-secret-scan.yml')
  assert.match(template, /\.gitleaks\.toml/)
  assert.ok(fs.existsSync(path.join(kb, 'templates', 'gitleaks.toml')))
})

test('Dependabot lists every folder of CI templates that names an image, and covers the workflow actions', () => {
  const config = read(root, '.github', 'dependabot.yml')
  const listed = [...config.matchAll(/^\s+- "(\/[^"]+)"\s*$/gm)].map((m) => new RegExp(`^${m[1].replace(/\./g, '\\.').replace(/\*/g, '[^/]+')}$`))
  const folders = new Set()
  const collect = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) collect(path.join(dir, e.name))
      else if (/^[^.].*\.ya?ml$/i.test(e.name) && /^\s*image:\s*\S+/m.test(read(dir, e.name))) folders.add('/' + path.relative(root, dir).split(path.sep).join('/'))
    }
  }
  collect(kb)
  assert.ok(folders.size >= 2)
  for (const folder of folders) assert.ok(listed.some((re) => re.test(folder)), `${folder} holds images but is not listed in .github/dependabot.yml`)
  assert.match(config, /package-ecosystem: "github-actions"/)
  assert.match(config, /cooldown:\s+default-days: \d+/)
})

test('every action in the workflows is pinned to a full commit', () => {
  const dir = path.join(root, '.github', 'workflows')
  const files = fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f))
  assert.ok(files.length >= 1)
  for (const file of files) {
    const uses = [...read(dir, file).matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)].map((m) => m[1])
    assert.ok(uses.length >= 1, `${file} uses no action, so the check proves nothing`)
    for (const u of uses) assert.match(u, /@[0-9a-f]{40}$/, `${file}: ${u} is not pinned to a commit`)
  }
})

test('the Renovate template is valid JSON, waits after a release, and never automerges', () => {
  const config = JSON.parse(read(kb, 'templates', 'renovate.json'))
  assert.ok(config.extends.includes('config:best-practices'))
  assert.match(config.minimumReleaseAge, /^\d+ days?$/)
  assert.ok(!JSON.stringify(config).includes('automerge'))
})

test('settings patch points at hook scripts that exist', () => {
  const patch = JSON.parse(read(root, 'settings.patch.json'))
  const scripts = JSON.stringify(patch).match(/__KIT_DIR__\/hooks\/security-kit\/[\w.-]+\.cjs/g) || []
  assert.ok(scripts.length >= 3)
  for (const s of scripts) assert.ok(fs.existsSync(path.join(root, s.replace('__KIT_DIR__/', ''))), s)
})
