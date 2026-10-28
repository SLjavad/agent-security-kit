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
  assert.ok(JSON.stringify(settings).includes('C:/kit/hooks/security-kit/guard-bash.cjs'))
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

test('a different node command never adds a second copy of a hook entry', () => {
  const once = m.merge({}, patch, kitDir).settings
  const other = JSON.parse(JSON.stringify(patch))
  for (const entries of Object.values(other.hooks)) for (const e of entries) for (const h of e.hooks) h.command = 'C:/node/node.exe'
  const twice = m.merge(once, other, kitDir)
  assert.deepStrictEqual(twice.settings, once)
  assert.deepStrictEqual(twice.added, [])
})

test('updateCommand rewrites the command of present entries in place, once', () => {
  const once = m.merge({}, patch, kitDir).settings
  const other = JSON.parse(JSON.stringify(patch))
  for (const entries of Object.values(other.hooks)) for (const e of entries) for (const h of e.hooks) h.command = 'C:/node/node.exe'
  const updated = m.merge(once, other, kitDir, { updateCommand: true })
  assert.strictEqual(updated.added.length, 3)
  assert.ok(updated.added.every((a) => /command updated/.test(a)))
  assert.strictEqual(updated.settings.hooks.PreToolUse.length, 2)
  assert.ok(Object.values(updated.settings.hooks).flat().every((e) => e.hooks[0].command === 'C:/node/node.exe'))
  assert.deepStrictEqual(m.merge(updated.settings, other, kitDir, { updateCommand: true }).added, [])
})

test('updateEnv changes an existing hook mode, and says so', () => {
  const base = m.merge({}, patch, kitDir).settings
  const enforce = { ...patch, env: { SECURITY_HOOKS_MODE: 'enforce' } }
  assert.strictEqual(m.merge(base, enforce, kitDir).settings.env.SECURITY_HOOKS_MODE, 'warn')
  const changed = m.merge(base, enforce, kitDir, { updateEnv: true })
  assert.strictEqual(changed.settings.env.SECURITY_HOOKS_MODE, 'enforce')
  assert.deepStrictEqual(changed.added, ['env.SECURITY_HOOKS_MODE (changed from warn to enforce)'])
  assert.deepStrictEqual(m.merge(changed.settings, enforce, kitDir, { updateEnv: true }).added, [])
})

test('hooks of other tools in similarly named folders are neither migrated nor removed', () => {
  const foreign = [
    { matcher: 'Bash', hooks: [{ type: 'command', command: 'node', args: ['C:/me/.claude/hooks/security/my-own-check.cjs'] }] },
    { matcher: 'Bash', hooks: [{ type: 'command', command: 'node', args: ['C:/me/.claude/hooks/security-kit/mine.cjs'] }] }
  ]
  const base = { hooks: { PreToolUse: foreign } }
  const merged = m.merge(base, patch, kitDir)
  assert.ok(foreign.every((f) => merged.settings.hooks.PreToolUse.some((e) => JSON.stringify(e) === JSON.stringify(f))))
  assert.ok(!merged.added.some((a) => /migrated/.test(a)))
  assert.deepStrictEqual(m.remove(merged.settings).settings, base)
})

test('merge normalises Windows kit paths to forward slashes', () => {
  const { settings } = m.merge({}, patch, 'D:\\tools\\kit')
  assert.ok(JSON.stringify(settings).includes('D:/tools/kit/hooks/security-kit/scan-write.cjs'))
})

test('merge replaces entries under the old hooks/security path and keeps unrelated ones', () => {
  const old = JSON.parse(JSON.stringify(patch).split('__KIT_DIR__').join(kitDir).split('hooks/security-kit/').join('hooks/security/'))
  const base = { env: old.env, hooks: { ...old.hooks, PreToolUse: [...old.hooks.PreToolUse, existing().hooks.PreToolUse[0]] } }
  const { settings, added } = m.merge(base, patch, kitDir)
  assert.ok(!JSON.stringify(settings).includes('hooks/security/'))
  assert.strictEqual(settings.hooks.PreToolUse.length, 3)
  assert.strictEqual(settings.hooks.PostToolUse.length, 1)
  assert.ok(added.some((a) => /migrated 2 entries/.test(a)))
  assert.ok(added.some((a) => /migrated 1 entry/.test(a)))
  assert.deepStrictEqual(m.merge(settings, patch, kitDir).added, [])
})

test('every hook the settings patch adds is recognised as a kit entry, so uninstall and migration always find it', () => {
  const resolved = JSON.parse(JSON.stringify(patch).split('__KIT_DIR__').join(kitDir))
  const entries = Object.values(resolved.hooks).flat()
  assert.ok(entries.length >= 3)
  for (const entry of entries) assert.ok(m.isKitEntry(entry), JSON.stringify(entry))
})

test('remove also deletes entries under the old hooks/security path', () => {
  const old = JSON.parse(JSON.stringify(patch).split('__KIT_DIR__').join(kitDir).split('hooks/security-kit/').join('hooks/security/'))
  assert.deepStrictEqual(m.remove({ hooks: old.hooks }).settings, {})
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
