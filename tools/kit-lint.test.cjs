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
  path.join(root, 'skills', 'security', 'SKILL.md'),
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
  const router = read(root, 'skills', 'security', 'SKILL.md')
  assert.match(router, /stack\.json/)
  assert.match(router, /detect/)
})

test('settings patch points at hook scripts that exist', () => {
  const patch = JSON.parse(read(root, 'settings.patch.json'))
  const scripts = JSON.stringify(patch).match(/__KIT_DIR__\/hooks\/security\/[\w.-]+\.cjs/g) || []
  assert.ok(scripts.length >= 3)
  for (const s of scripts) assert.ok(fs.existsSync(path.join(root, s.replace('__KIT_DIR__/', ''))), s)
})
