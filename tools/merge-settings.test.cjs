const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const m = require('./merge-settings.cjs')

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-merge-'))
const script = path.join(__dirname, 'merge-settings.cjs')
const patch = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'settings.patch.json'), 'utf8'))
const kitDir = 'C:/kit'

const existing = () => ({
  permissions: { deny: ['Read(//**/.env)'] },
  env: { OTHER: '1' },
  hooks: {
    PreToolUse: [{ matcher: 'Grep|Glob|Bash', hooks: [{ type: 'command', command: 'tool.exe', args: ['hook-augment'] }] }],
    SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'tool.exe', args: ['hook-augment'] }] }]
  }
})

const writeSettings = (name, data, eol = '\n', indent = '    ') => {
  const file = path.join(tmp, name)
  fs.writeFileSync(file, JSON.stringify(data, null, indent).replace(/\n/g, eol) + eol)
  return file
}

const cli = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })

test('merge adds kit hooks and env, keeps everything else', () => {
  const { settings, added } = m.merge(existing(), patch, kitDir)
  assert.deepStrictEqual(settings.permissions, existing().permissions)
  assert.strictEqual(settings.env.OTHER, '1')
  assert.strictEqual(settings.env.SECURITY_HOOKS_MODE, 'warn')
  assert.strictEqual(settings.hooks.SessionStart.length, 1)
  assert.strictEqual(settings.hooks.PreToolUse.length, 3)
  assert.strictEqual(settings.hooks.PostToolUse.length, 1)
  assert.strictEqual(added.length, 4)
  assert.ok(JSON.stringify(settings).includes('C:/kit/hooks/security/guard-bash.cjs'))
  assert.ok(!JSON.stringify(settings).includes('__KIT_DIR__'))
})

test('merge is idempotent', () => {
  const once = m.merge(existing(), patch, kitDir).settings
  const twice = m.merge(once, patch, kitDir)
  assert.deepStrictEqual(twice.settings, once)
  assert.deepStrictEqual(twice.added, [])
})

test('merge does not overwrite an existing hook mode', () => {
  const base = existing()
  base.env.SECURITY_HOOKS_MODE = 'enforce'
  assert.strictEqual(m.merge(base, patch, kitDir).settings.env.SECURITY_HOOKS_MODE, 'enforce')
})

test('merge normalises Windows kit paths to forward slashes', () => {
  const { settings } = m.merge({}, patch, 'D:\\tools\\kit')
  assert.ok(JSON.stringify(settings).includes('D:/tools/kit/hooks/security/scan-write.cjs'))
})

test('remove deletes only kit entries and restores the original', () => {
  const merged = m.merge(existing(), patch, kitDir).settings
  const { settings, removed } = m.remove(merged)
  assert.deepStrictEqual(settings, existing())
  assert.ok(removed.includes('env.SECURITY_HOOKS_MODE'))
})

test('remove on a file without kit entries changes nothing', () => {
  const { settings, removed } = m.remove(existing())
  assert.deepStrictEqual(settings, existing())
  assert.deepStrictEqual(removed, [])
})

test('CLI dry run leaves the file untouched', () => {
  const file = writeSettings('dry.json', existing())
  const before = fs.readFileSync(file, 'utf8')
  const r = cli('--settings', file, '--kit-dir', kitDir)
  assert.strictEqual(r.status, 0)
  assert.match(r.stdout, /Would add/)
  assert.strictEqual(fs.readFileSync(file, 'utf8'), before)
  assert.deepStrictEqual(fs.readdirSync(tmp).filter((f) => f.startsWith('dry.json.bak')), [])
})

test('CLI apply writes a backup, keeps CRLF and indentation, and a second run is a no-op', () => {
  const file = writeSettings('apply.json', existing(), '\r\n', '\t')
  const original = fs.readFileSync(file, 'utf8')
  const r = cli('--settings', file, '--kit-dir', kitDir, '--apply')
  assert.strictEqual(r.status, 0)
  const backups = fs.readdirSync(tmp).filter((f) => f.startsWith('apply.json.bak'))
  assert.strictEqual(backups.length, 1)
  assert.strictEqual(fs.readFileSync(path.join(tmp, backups[0]), 'utf8'), original)
  const written = fs.readFileSync(file, 'utf8')
  assert.ok(written.includes('\r\n') && !/[^\r]\n/.test(written))
  assert.ok(written.includes('\t"hooks"'))
  const again = cli('--settings', file, '--kit-dir', kitDir, '--apply')
  assert.match(again.stdout, /No changes needed/)
  assert.strictEqual(fs.readdirSync(tmp).filter((f) => f.startsWith('apply.json.bak')).length, 1)
})

test('CLI remove restores a merged file', () => {
  const file = writeSettings('rm.json', existing())
  cli('--settings', file, '--kit-dir', kitDir, '--apply')
  const r = cli('--settings', file, '--remove', '--apply')
  assert.strictEqual(r.status, 0)
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')), existing())
})

test('CLI refuses malformed settings and missing arguments', () => {
  const bad = path.join(tmp, 'bad.json')
  fs.writeFileSync(bad, '{ not json')
  const r = cli('--settings', bad, '--kit-dir', kitDir, '--apply')
  assert.strictEqual(r.status, 1)
  assert.strictEqual(fs.readFileSync(bad, 'utf8'), '{ not json')
  assert.strictEqual(cli('--kit-dir', kitDir).status, 1)
  assert.strictEqual(cli('--settings', bad).status, 1)
  assert.strictEqual(cli('--bogus').status, 1)
})

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
