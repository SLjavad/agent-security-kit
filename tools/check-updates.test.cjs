const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const fetcher = require('./fetch-third-party.cjs')
const cu = require('./check-updates.cjs')

const root = path.join(__dirname, '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-updates-'))
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8')
const cadence = () => read('security-kb', 'stacks', 'dotnet', 'patching-cadence.md')
const template = () => read('security-kb', 'stacks', 'dotnet', 'templates', 'gitlab-ci-dependency-audit.yml')

const release = (channel, type, phase, eol, sdk) => ({ 'channel-version': channel, 'release-type': type, 'support-phase': phase, 'eol-date': eol, 'latest-sdk': sdk })
const feedOf = (...releases) => ({ 'releases-index': releases })
const currentFeed = () => feedOf(
  release('11.0', 'sts', 'go-live', null, '11.0.100-rc.3'),
  release('10.0', 'lts', 'active', '2028-11-14', '10.0.403'),
  release('9.0', 'sts', 'maintenance', '2026-11-10', '9.0.320'),
  release('8.0', 'lts', 'maintenance', '2026-11-10', '8.0.427'),
  release('7.0', 'sts', 'eol', '2024-05-14', '7.0.410')
)
const actionsOf = (items) => items.filter((i) => i.level === 'action').map((i) => `${i.subject}: ${i.text}`).join(' | ')

test('the documented support line is read as versions, types and end dates', () => {
  assert.deepStrictEqual(cu.parseSupported(cadence()), [
    { channel: '10.0', type: 'LTS', month: 11, year: 2028 },
    { channel: '9.0', type: 'STS', month: 11, year: 2026 },
    { channel: '8.0', type: 'LTS', month: 11, year: 2026 }
  ])
  assert.deepStrictEqual(cu.parseSupported('no such line'), [])
})

test('the shipped .NET docs and template agree with the Microsoft feed values they were written from', () => {
  const items = cu.checkDotnet({ feed: currentFeed(), cadenceText: cadence(), templateText: template() })
  assert.deepStrictEqual(items.map((i) => i.level), ['ok'])
})

test('every kind of .NET drift is reported', () => {
  const check = (feed, text = cadence(), templateText = template()) => actionsOf(cu.checkDotnet({ feed, cadenceText: text, templateText }))
  const without = (channel) => feedOf(...currentFeed()['releases-index'].filter((r) => r['channel-version'] !== channel))
  const changed = (channel, patch) => feedOf(...currentFeed()['releases-index'].map((r) => (r['channel-version'] === channel ? { ...r, ...patch } : r)))
  assert.match(check(without('9.0')), /\.NET 9\.0: documented as supported but absent/)
  assert.match(check(changed('9.0', { 'support-phase': 'eol' })), /\.NET 9\.0: documented as supported, but Microsoft lists it as eol/)
  assert.match(check(changed('8.0', { 'eol-date': '2026-12-08' })), /\.NET 8\.0: documented end of support is November 2026, the feed says 2026-12-08/)
  assert.match(check(changed('10.0', { 'release-type': 'sts' })), /\.NET 10\.0: documented as LTS, the feed says STS/)
  assert.match(check(changed('11.0', { 'support-phase': 'active', 'eol-date': '2029-11-14' })), /\.NET 11\.0: supported by Microsoft .* missing from patching-cadence\.md/)
  assert.match(check(changed('10.0', { 'latest-sdk': '10.0.404' })), /pinned image was tested with SDK 10\.0\.403; Microsoft lists 10\.0\.404/)
  assert.match(check(changed('10.0', { 'support-phase': 'eol' })), /SDK channel 10\.0, which Microsoft lists as eol/)
  assert.match(check(currentFeed(), 'nothing here'), /no "Listed as supported" line/)
  assert.match(check(currentFeed(), cadence(), 'image: x'), /could not be read from the template/)
})

test('stacks older than the limit, or without a valid verified month, are reported', () => {
  const stacks = path.join(tmp, 'stacks')
  const stack = (name, body) => {
    fs.mkdirSync(path.join(stacks, name), { recursive: true })
    if (body !== null) fs.writeFileSync(path.join(stacks, name, 'stack.json'), body)
  }
  stack('fresh', '{"verified":"2026-10"}')
  stack('edge', '{"verified":"2026-04"}')
  stack('stale', '{"verified":"2026-03"}')
  stack('badformat', '{"verified":"October 2026"}')
  stack('nofile', null)
  stack('_template', '{"verified":"2000-01"}')
  const byName = Object.fromEntries(cu.checkStacks(stacks, new Date('2026-10-28T00:00:00Z'), 6).map((i) => [i.subject, i]))
  assert.deepStrictEqual(Object.keys(byName).sort(), ['badformat', 'edge', 'fresh', 'nofile', 'stale'])
  assert.strictEqual(byName.fresh.level, 'ok')
  assert.strictEqual(byName.edge.level, 'ok')
  assert.strictEqual(byName.stale.level, 'action')
  assert.match(byName.stale.text, /7 months ago \(limit 6\)/)
  assert.match(byName.badformat.text, /must look like 2026-10/)
  assert.match(byName.nofile.text, /missing or unreadable/)
})

test('third-party results separate real work from noise and from failures', () => {
  const lock = fetcher.loadLock()
  const pick = (state) => cu.checkThirdParty({ sources: lock.sources.slice(0, 1) }, () => state)[0]
  const head = 'b'.repeat(40)
  assert.strictEqual(pick({ state: 'unchanged', head }).level, 'ok')
  assert.strictEqual(pick({ state: 'moved', head, changed: 0, reasons: [] }).level, 'info')
  const reviewable = pick({ state: 'moved', head, changed: 3, reasons: [] })
  assert.strictEqual(reviewable.level, 'action')
  assert.match(reviewable.text, /3 installed file\(s\) changed.*move sha and reviewedSha together.*\/compare\/[0-9a-f]{12}\.\.\.bbbbbbbbbbbb/)
  const refused = pick({ state: 'moved', head, changed: 2, reasons: ['a.sh: is executable'] })
  assert.strictEqual(refused.level, 'action')
  assert.match(refused.text, /gate refused it \(a\.sh: is executable\)/)
  assert.strictEqual(pick({ state: 'unreachable', error: 'no route' }).level, 'error')
  assert.strictEqual(pick({ state: 'error', head, error: 'bad object' }).level, 'error')
})

const gitIn = (dir, ...args) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.test', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: dir, encoding: 'utf8' })

test('compareUpstream tells unchanged, moved and unreachable repositories apart', () => {
  const dir = path.join(tmp, 'upstream.git')
  fs.mkdirSync(path.join(dir, 'skills', 'a'), { recursive: true })
  gitIn(dir, 'init', '-q')
  fs.writeFileSync(path.join(dir, 'skills', 'a', 'SKILL.md'), 'one\n')
  gitIn(dir, 'add', '-A')
  gitIn(dir, 'commit', '-q', '-m', 'base')
  const base = gitIn(dir, 'rev-parse', 'HEAD').stdout.trim()
  const source = { id: 'local', repo: dir.replace(/\.git$/, ''), sha: base, include: [{ from: 'skills/a', to: 'skills/a' }] }
  assert.deepStrictEqual(fetcher.compareUpstream(source), { state: 'unchanged', head: base })
  fs.writeFileSync(path.join(dir, 'skills', 'a', 'SKILL.md'), 'two\n')
  gitIn(dir, 'commit', '-q', '-am', 'edit')
  const head = gitIn(dir, 'rev-parse', 'HEAD').stdout.trim()
  assert.deepStrictEqual(fetcher.compareUpstream(source), { state: 'moved', head, changed: 1, reasons: [] })
  fs.writeFileSync(path.join(dir, 'skills', 'a', 'run.sh'), 'echo\n')
  gitIn(dir, 'add', '-A')
  gitIn(dir, 'commit', '-q', '-m', 'script')
  assert.match(fetcher.compareUpstream(source).reasons.join(), /run\.sh/)
  assert.strictEqual(fetcher.compareUpstream({ ...source, repo: path.join(tmp, 'missing') }).state, 'unreachable')
})

test('run reports a failed check as an error and keeps the other results', async () => {
  const items = await cu.run({ root, only: ['dotnet', 'stacks'], feed: async () => { throw new Error('the .NET release feed answered 503') }, maxAgeMonths: 600 })
  assert.ok(items.some((i) => i.level === 'error' && i.area === 'dotnet' && /503/.test(i.text)))
  assert.ok(items.some((i) => i.area === 'stacks' && i.level === 'ok'))
})

test('exit code bits: 1 when a check could not run, 2 when something needs review', () => {
  const of = (...levels) => cu.exitCode(levels.map((level) => ({ level })))
  assert.strictEqual(of('ok', 'info'), 0)
  assert.strictEqual(of('ok', 'error'), 1)
  assert.strictEqual(of('action', 'info'), 2)
  assert.strictEqual(of('action', 'error'), 3)
})

test('the report is a markdown table per area, escapes pipes, and counts what matters', () => {
  const report = cu.buildReport([
    { level: 'action', area: 'dotnet', subject: '.NET 9.0', text: 'a | b' },
    { level: 'error', area: 'third-party', subject: 'x', text: 'down' },
    { level: 'ok', area: 'stacks', subject: 'dotnet', text: 'fine' }
  ], new Date('2026-10-28T00:00:00Z'))
  assert.match(report, /^# Security kit update check \(2026-10-28\)/)
  assert.match(report, /1 item\(s\) need review, 1 check\(s\) could not run\./)
  assert.match(report, /\| \.NET 9\.0 \| ACTION \| a \\\| b \|/)
  assert.match(report, /\| x \| COULD NOT CHECK \| down \|/)
  assert.ok(report.indexOf('## Third-party skills') < report.indexOf('## .NET') && report.indexOf('## .NET') < report.indexOf('## Stacks'))
})

test('parseArgs accepts the documented options and rejects the rest', () => {
  assert.deepStrictEqual(cu.parseArgs([]), { only: ['third-party', 'dotnet', 'stacks'], maxAgeMonths: 6 })
  assert.deepStrictEqual(cu.parseArgs(['--only', 'stacks', '--max-age-months', '12']), { only: ['stacks'], maxAgeMonths: 12 })
  assert.throws(() => cu.parseArgs(['--only', 'nope']), /--only takes/)
  assert.throws(() => cu.parseArgs(['--only']), /--only takes/)
  assert.throws(() => cu.parseArgs(['--max-age-months', 'x']), /whole number/)
  assert.throws(() => cu.parseArgs(['--bogus']), /unknown argument/)
})

test('the command line prints the report, uses the exit code, and fails cleanly on bad arguments', () => {
  const script = path.join(__dirname, 'check-updates.cjs')
  const ok = spawnSync(process.execPath, [script, '--only', 'stacks', '--max-age-months', '600'], { encoding: 'utf8' })
  assert.strictEqual(ok.status, 0)
  assert.match(ok.stdout, /# Security kit update check/)
  assert.match(ok.stdout, /\| dotnet \| ok \|/)
  const bad = spawnSync(process.execPath, [script, '--bogus'], { encoding: 'utf8' })
  assert.strictEqual(bad.status, 1)
  assert.match(bad.stderr, /unknown argument/)
})

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
