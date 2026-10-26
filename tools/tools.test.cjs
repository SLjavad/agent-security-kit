const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const fetcher = require('./fetch-third-party.cjs')
const scanner = require('./prepublish-scan.cjs')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-tools-'))
const goodSha = 'a'.repeat(40)
const source = (over = {}) => ({ id: 's', repo: 'https://github.com/o/r', sha: goodSha, license: 'MIT', review: 'partial', reviewedSha: goodSha, include: [{ from: 'a', to: 'b' }], ...over })

test('safeJoin keeps paths inside the root', () => {
  assert.ok(fetcher.safeJoin(tmp, 'a/b').startsWith(tmp))
  assert.throws(() => fetcher.safeJoin(tmp, '../x'))
  assert.throws(() => fetcher.safeJoin(tmp, 'a/../../x'))
  assert.throws(() => fetcher.safeJoin(tmp, path.resolve(os.tmpdir(), 'elsewhere')))
})

test('validateSource accepts a well-formed source', () => {
  assert.doesNotThrow(() => fetcher.validateSource(source()))
})

test('validateSource rejects unpinned, foreign, and escaping sources', () => {
  assert.throws(() => fetcher.validateSource(source({ sha: 'main' })), /sha/)
  assert.throws(() => fetcher.validateSource(source({ sha: 'A'.repeat(40) })), /sha/)
  assert.throws(() => fetcher.validateSource(source({ repo: 'http://github.com/o/r' })), /repository/)
  assert.throws(() => fetcher.validateSource(source({ repo: 'https://evil.example/o/r' })), /repository/)
  assert.throws(() => fetcher.validateSource(source({ review: 'trusted' })), /review/)
  assert.throws(() => fetcher.validateSource(source({ include: [{ from: '../a', to: 'b' }] })), /escapes/)
  assert.throws(() => fetcher.validateSource(source({ include: [{ from: 'a', to: '../../b' }] })), /escapes/)
  assert.throws(() => fetcher.validateSource(source({ remove: ['../x'] })), /escapes/)
})

test('a review recorded at another commit than the pin is rejected', () => {
  assert.throws(() => fetcher.validateSource(source({ reviewedSha: 'b'.repeat(40) })), /re-review before changing the pin/)
})

test('a reviewed source must record the commit it was reviewed at, an unreviewed one need not', () => {
  const noSha = source()
  delete noSha.reviewedSha
  assert.throws(() => fetcher.validateSource(noSha), /must record reviewedSha/)
  assert.doesNotThrow(() => fetcher.validateSource({ ...noSha, review: 'none' }))
})

test('optional sources are skipped unless asked for, independently of the review state', () => {
  const lock = { sources: [source({ id: 'a' }), source({ id: 'b', optional: true }), source({ id: 'c', optional: true, review: 'none' })] }
  const ids = (argv) => fetcher.select(lock, fetcher.parseArgs(argv)).map((s) => s.id)
  assert.deepStrictEqual(ids([]), ['a'])
  assert.deepStrictEqual(ids(['--include-optional']), ['a', 'b'])
  assert.deepStrictEqual(ids(['--include-optional', '--include-unreviewed']), ['a', 'b', 'c'])
})

test('the shipped lock file validates and pins every source', () => {
  const lock = fetcher.loadLock()
  assert.ok(lock.sources.length >= 5)
  for (const s of lock.sources) assert.match(s.sha, /^[0-9a-f]{40}$/)
  for (const s of lock.sources.filter((x) => x.review !== 'none')) assert.strictEqual(s.reviewedSha, s.sha, s.id)
  assert.ok(lock.sources.filter((s) => s.optional).every((s) => s.id.endsWith('-curated')))
})

test('setTools rewrites inline and list tool declarations and keeps the body', () => {
  const inline = path.join(tmp, 'inline.md')
  fs.writeFileSync(inline, '---\nname: a\ntools: Read, Grep, Glob, Bash\nmodel: x\n---\nBody\n')
  fetcher.setTools(inline, ['Read', 'Grep'])
  assert.strictEqual(fs.readFileSync(inline, 'utf8'), '---\nname: a\ntools: Read, Grep\nmodel: x\n---\nBody\n')

  const list = path.join(tmp, 'list.md')
  fs.writeFileSync(list, '---\nname: b\nmodel: inherit\ntools:\n  - Read\n  - Write\n  - Bash\ncolor: red\n---\nBody\n')
  fetcher.setTools(list, ['Read', 'Grep', 'Glob'])
  assert.strictEqual(fs.readFileSync(list, 'utf8'), '---\nname: b\nmodel: inherit\ntools: Read, Grep, Glob\ncolor: red\n---\nBody\n')

  const crlf = path.join(tmp, 'crlf.md')
  fs.writeFileSync(crlf, '---\r\nname: c\r\ntools:\r\n  - Read\r\n  - Bash\r\n---\r\nBody\r\n')
  fetcher.setTools(crlf, ['Read'])
  assert.match(fs.readFileSync(crlf, 'utf8'), /tools: Read\r\n---/)
})

test('setTools refuses files without front matter or a tools entry', () => {
  const none = path.join(tmp, 'none.md')
  fs.writeFileSync(none, 'no front matter')
  assert.throws(() => fetcher.setTools(none, ['Read']), /front matter/)
  const missing = path.join(tmp, 'missing.md')
  fs.writeFileSync(missing, '---\nname: x\n---\nBody')
  assert.throws(() => fetcher.setTools(missing, ['Read']), /tools entry/)
})

test('select skips unreviewed sources unless asked', () => {
  const lock = { sources: [source({ id: 'a', review: 'partial' }), source({ id: 'b', review: 'none' })] }
  assert.deepStrictEqual(fetcher.select(lock, fetcher.parseArgs([])).map((s) => s.id), ['a'])
  assert.deepStrictEqual(fetcher.select(lock, fetcher.parseArgs(['--include-unreviewed'])).map((s) => s.id), ['a', 'b'])
  assert.deepStrictEqual(fetcher.select(lock, fetcher.parseArgs(['--include-unreviewed', '--only', 'b'])).map((s) => s.id), ['b'])
})

test('parseArgs rejects unknown flags', () => {
  assert.throws(() => fetcher.parseArgs(['--nope']), /unknown argument/)
})

test('dry run lists the plan and writes nothing', () => {
  const target = path.join(tmp, 'dry-target')
  const r = spawnSync(process.execPath, [path.join(__dirname, 'fetch-third-party.cjs'), '--target', target], { encoding: 'utf8' })
  assert.strictEqual(r.status, 0)
  assert.match(r.stdout, /Plan \(dry run/)
  assert.match(r.stdout, /Skipped: .*mukul975-curated/)
  assert.ok(!fs.existsSync(target))
})

test('prepublish scan flags personal paths, addresses, internal hosts, and private IPs', () => {
  const rules = (text, terms = []) => scanner.scanText(text, terms).map((f) => f.rule)
  assert.ok(rules('see C:\\Users\\bob\\work').includes('windows-user-path'))
  assert.ok(rules('see /home/alice/project/').includes('unix-home-path'))
  assert.ok(rules('mail bob@corp-mail.test').includes('email-address'))
  assert.ok(rules('host git.mycompany.internal').includes('internal-hostname'))
  assert.ok(rules('ip 10.1.2.3').includes('private-ip'))
  assert.ok(rules('ip 192.168.0.9').includes('private-ip'))
})

test('prepublish scan flags secrets without echoing them and honours the terms list', () => {
  const key = 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP'
  const found = scanner.scanText(`token ${key}`, [])
  assert.deepStrictEqual(found.map((f) => f.rule), ['secret:aws-access-key'])
  assert.ok(!JSON.stringify(found).includes(key))
  assert.deepStrictEqual(scanner.scanText('Project Falcon notes', ['falcon']).map((f) => f.rule), ['term#1'])
})

test('prepublish scan accepts placeholders and documentation addresses', () => {
  assert.deepStrictEqual(scanner.scanText('C:\\Users\\<name>\\x and ~/.claude and user@example.com and 8.8.8.8', []), [])
})

test('prepublish scan exempts test files from path rules but not from secret or term rules', () => {
  const dir = fs.mkdtempSync(path.join(tmp, 'tests-'))
  const key = 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP'
  fs.writeFileSync(path.join(dir, 'a.test.cjs'), `const p = 'C:\\\\Users\\\\bob\\\\x'\nconst k = '${key}'\nconst t = 'falcon'\n`)
  const rulesFound = scanner.scanDir(dir, ['falcon']).map((f) => f.rule).sort()
  assert.deepStrictEqual(rulesFound, ['secret:aws-access-key', 'term#1'])
})

test('prepublish scan walks a directory and the CLI exits non-zero when dirty', () => {
  const dirty = fs.mkdtempSync(path.join(tmp, 'dirty-'))
  fs.writeFileSync(path.join(dirty, 'a.md'), 'clean\nC:\\Users\\bob\\x\n')
  const findings = scanner.scanDir(dirty)
  assert.deepStrictEqual(findings.map((f) => [f.file, f.line, f.rule]), [['a.md', 2, 'windows-user-path']])
  const r = spawnSync(process.execPath, [path.join(__dirname, 'prepublish-scan.cjs'), dirty], { encoding: 'utf8' })
  assert.strictEqual(r.status, 1)
  const clean = fs.mkdtempSync(path.join(tmp, 'clean-'))
  fs.writeFileSync(path.join(clean, 'a.md'), 'nothing here')
  assert.strictEqual(spawnSync(process.execPath, [path.join(__dirname, 'prepublish-scan.cjs'), clean], { encoding: 'utf8' }).status, 0)
})

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
