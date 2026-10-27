const test = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const realKit = path.join(__dirname, '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-install-'))

const copyKit = () => {
  const dest = fs.mkdtempSync(path.join(tmp, 'kit-'))
  fs.cpSync(realKit, dest, { recursive: true, filter: (p) => !/[\\/](\.git|node_modules)([\\/]|$)/.test(p) })
  return dest
}

const newClaudeDir = (settings) => {
  const dir = fs.mkdtempSync(path.join(tmp, 'claude-'))
  if (settings) fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(settings, null, 4) + '\n')
  return dir
}

const install = (kit, claudeDir, ...args) => {
  const withNetwork = args.includes('--network')
  const rest = args.filter((a) => a !== '--network')
  const extra = withNetwork || rest.includes('--pin-reviewed') ? [] : ['--offline']
  const r = spawnSync(process.execPath, [path.join(kit, 'tools', 'install.cjs'), '--claude-dir', claudeDir, ...rest, ...extra], { encoding: 'utf8' })
  return { code: r.status, out: r.stdout, err: r.stderr }
}

const online = spawnSync('git', ['ls-remote', 'https://github.com/agamm/claude-code-owasp.git', 'HEAD'], { encoding: 'utf8', timeout: 30000 }).status === 0
const needsNetwork = online ? {} : { skip: 'GitHub is not reachable' }

const snapshot = (dir) => {
  const out = {}
  const walk = (d, rel = '') => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const next = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(path.join(d, e.name), next)
      else out[next] = fs.readFileSync(path.join(d, e.name), 'utf8')
    }
  }
  walk(dir)
  return out
}

const existingSettings = () => ({
  permissions: { deny: ['Read(//**/.env)'] },
  hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'other.exe', args: ['hook'] }] }] }
})

const sharedKit = copyKit()

test('dry run changes nothing and says so', () => {
  const claude = newClaudeDir(existingSettings())
  const before = snapshot(claude)
  const r = install(sharedKit, claude, '--dry-run')
  assert.strictEqual(r.code, 0, r.err)
  assert.match(r.out, /DRY RUN/)
  assert.match(r.out, /\d+ create/)
  assert.match(r.out, /would add env\.SECURITY_HOOKS_MODE/)
  assert.match(r.out, /Re-run without --dry-run to install/)
  assert.deepStrictEqual(snapshot(claude), before)
})

test('apply installs files, merges settings, writes a manifest, and the smoke test passes', () => {
  const claude = newClaudeDir(existingSettings())
  const r = install(sharedKit, claude)
  assert.strictEqual(r.code, 0, r.out + r.err)
  assert.match(r.out, /smoke test ok\s+shell guard blocks pipe-to-shell/)
  assert.ok(!/FAIL/.test(r.out))
  const files = snapshot(claude)
  for (const rel of ['skills/security-kit/SKILL.md', 'agents/security-reviewer.md', 'security-kb/INDEX.md', 'security-kb/core/dependency-supply-chain.md', 'security-kb/stacks/dotnet/stack.json', 'hooks/security-kit/guard-bash.cjs', 'hooks/security-kit/lib.cjs', 'hooks/security-kit/patterns.json']) {
    assert.ok(rel in files, rel)
  }
  assert.ok(!Object.keys(files).some((f) => f.endsWith('.test.cjs')))
  assert.ok(!Object.keys(files).some((f) => f.startsWith('hooks/security-kit/logs')))
  const settings = JSON.parse(files['settings.json'])
  assert.deepStrictEqual(settings.permissions, existingSettings().permissions)
  assert.strictEqual(settings.hooks.PreToolUse.length, 3)
  assert.strictEqual(settings.env.SECURITY_HOOKS_MODE, 'warn')
  assert.ok(JSON.stringify(settings).includes(claude.replace(/\\/g, '/') + '/hooks/security-kit/guard-bash.cjs'))
  const manifest = JSON.parse(files['.agent-security-kit-manifest.json'])
  assert.strictEqual(manifest.kit, 'agent-security-kit')
  assert.ok(manifest.files['skills/security-kit/SKILL.md'])
  assert.ok(Object.keys(fs.readdirSync(claude)).length > 0)
  assert.ok(fs.readdirSync(claude).some((f) => f.startsWith('settings.json.bak-')))
})

test('apply is idempotent', () => {
  const claude = newClaudeDir()
  assert.strictEqual(install(sharedKit, claude).code, 0)
  const before = snapshot(claude)
  const again = install(sharedKit, claude)
  assert.strictEqual(again.code, 0)
  assert.match(again.out, /Files: \d+ unchanged/)
  assert.match(again.out, /already up to date/)
  assert.deepStrictEqual(snapshot(claude), { ...before, '.agent-security-kit-manifest.json': snapshot(claude)['.agent-security-kit-manifest.json'] })
})

test('a file you already own is a conflict, nothing is written, and --force backs it up', () => {
  const claude = newClaudeDir()
  fs.mkdirSync(path.join(claude, 'skills', 'security-kit'), { recursive: true })
  fs.writeFileSync(path.join(claude, 'skills', 'security-kit', 'SKILL.md'), 'my own skill')
  const before = snapshot(claude)
  const dry = install(sharedKit, claude, '--dry-run')
  assert.strictEqual(dry.code, 2)
  assert.match(dry.out, /conflict\s+skills\/security-kit\/SKILL\.md/)
  const refused = install(sharedKit, claude)
  assert.strictEqual(refused.code, 2)
  assert.deepStrictEqual(snapshot(claude), before)
  const forced = install(sharedKit, claude, '--force')
  assert.strictEqual(forced.code, 0, forced.out + forced.err)
  const backups = fs.readdirSync(claude).filter((f) => f.startsWith('.agent-security-kit-backup-'))
  assert.strictEqual(backups.length, 1)
  assert.strictEqual(fs.readFileSync(path.join(claude, backups[0], 'skills', 'security-kit', 'SKILL.md'), 'utf8'), 'my own skill')
})

test('updating from a newer kit replaces unmodified files and protects local edits', () => {
  const kit = copyKit()
  const claude = newClaudeDir()
  assert.strictEqual(install(kit, claude).code, 0)
  fs.appendFileSync(path.join(kit, 'security-kb', 'core', 'patching-cadence.md'), '\nNew line from a newer kit.\n')
  const update = install(kit, claude)
  assert.strictEqual(update.code, 0, update.out)
  assert.match(update.out, /update\s+security-kb\/core\/patching-cadence\.md/)
  assert.match(fs.readFileSync(path.join(claude, 'security-kb', 'core', 'patching-cadence.md'), 'utf8'), /New line from a newer kit/)
  fs.appendFileSync(path.join(claude, 'security-kb', 'core', 'patching-cadence.md'), 'my local note\n')
  fs.appendFileSync(path.join(kit, 'security-kb', 'core', 'patching-cadence.md'), 'Another upstream line.\n')
  const protectedRun = install(kit, claude)
  assert.strictEqual(protectedRun.code, 2)
  assert.match(fs.readFileSync(path.join(claude, 'security-kb', 'core', 'patching-cadence.md'), 'utf8'), /my local note/)
})

test('an install made under the old security names is migrated: old files and hook entries go, the old log stays', () => {
  const kit = copyKit()
  const claude = newClaudeDir()
  const sha = (file) => require('crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex')
  const files = {}
  const legacy = (fromDir, toDir) => {
    for (const name of fs.readdirSync(path.join(kit, fromDir)).filter((n) => !/\.test\.cjs$/.test(n))) {
      const dest = path.join(claude, toDir, name)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.copyFileSync(path.join(kit, fromDir, name), dest)
      files[`${toDir}/${name}`] = sha(dest)
    }
  }
  legacy('hooks/security-kit', 'hooks/security')
  legacy('skills/security-kit', 'skills/security')
  fs.mkdirSync(path.join(claude, 'hooks', 'security', 'logs'), { recursive: true })
  fs.writeFileSync(path.join(claude, 'hooks', 'security', 'logs', 'findings.jsonl'), '{"old":true}\n')
  fs.writeFileSync(path.join(claude, '.agent-security-kit-manifest.json'), JSON.stringify({ kit: 'agent-security-kit', files, thirdParty: [] }))
  const patch = JSON.parse(fs.readFileSync(path.join(kit, 'settings.patch.json'), 'utf8').split('__KIT_DIR__').join(claude.replace(/\\/g, '/')).split('hooks/security-kit/').join('hooks/security/'))
  fs.writeFileSync(path.join(claude, 'settings.json'), JSON.stringify({ env: patch.env, hooks: { ...patch.hooks, PreToolUse: [...patch.hooks.PreToolUse, existingSettings().hooks.PreToolUse[0]] } }, null, 2))
  const r = install(kit, claude)
  assert.strictEqual(r.code, 0, r.out + r.err)
  assert.match(r.out, /migrated 2 entries from hooks\/security to hooks\/security-kit/)
  assert.ok(!fs.existsSync(path.join(claude, 'skills', 'security')))
  assert.ok(!fs.existsSync(path.join(claude, 'hooks', 'security', 'guard-bash.cjs')))
  assert.strictEqual(fs.readFileSync(path.join(claude, 'hooks', 'security', 'logs', 'findings.jsonl'), 'utf8'), '{"old":true}\n')
  assert.ok(fs.existsSync(path.join(claude, 'hooks', 'security-kit', 'guard-bash.cjs')))
  const settings = fs.readFileSync(path.join(claude, 'settings.json'), 'utf8')
  assert.ok(!/hooks\/security\//.test(settings))
  assert.strictEqual((settings.match(/guard-bash\.cjs/g) || []).length, 1)
  assert.strictEqual((settings.match(/other\.exe/g) || []).length, 1)
  assert.strictEqual(install(kit, claude).code, 0)
})

test('files removed from the kit are removed on update only when unmodified', () => {
  const kit = copyKit()
  const claude = newClaudeDir()
  install(kit, claude)
  fs.rmSync(path.join(kit, 'security-kb', 'core', 'compliance-conditional.md'))
  fs.rmSync(path.join(kit, 'security-kb', 'core', 'performance-vs-security.md'))
  fs.appendFileSync(path.join(claude, 'security-kb', 'core', 'performance-vs-security.md'), 'edited\n')
  const r = install(kit, claude, '--no-smoke-test')
  assert.strictEqual(r.code, 0, r.out)
  assert.ok(!fs.existsSync(path.join(claude, 'security-kb', 'core', 'compliance-conditional.md')))
  assert.ok(fs.existsSync(path.join(claude, 'security-kb', 'core', 'performance-vs-security.md')))
})

test('--hooks-mode, --node-command, and --no-settings are honoured', () => {
  const a = newClaudeDir()
  assert.strictEqual(install(sharedKit, a, '--hooks-mode', 'enforce', '--node-command', 'C:/Program Files/nodejs/node.exe', '--no-smoke-test').code, 0)
  const settings = JSON.parse(fs.readFileSync(path.join(a, 'settings.json'), 'utf8'))
  assert.strictEqual(settings.env.SECURITY_HOOKS_MODE, 'enforce')
  assert.ok(settings.hooks.PreToolUse.every((e) => e.hooks[0].command === 'C:/Program Files/nodejs/node.exe'))
  const b = newClaudeDir()
  assert.strictEqual(install(sharedKit, b, '--no-settings').code, 0)
  assert.ok(!fs.existsSync(path.join(b, 'settings.json')))
})

test('reinstalling with --node-command or --hooks-mode changes the existing entries instead of adding more', () => {
  const claude = newClaudeDir()
  assert.strictEqual(install(sharedKit, claude, '--no-smoke-test').code, 0)
  const again = install(sharedKit, claude, '--node-command', 'C:/node/node.exe', '--hooks-mode', 'enforce', '--no-smoke-test')
  assert.strictEqual(again.code, 0, again.out + again.err)
  assert.match(again.out, /command updated/)
  assert.match(again.out, /changed from warn to enforce/)
  const settings = JSON.parse(fs.readFileSync(path.join(claude, 'settings.json'), 'utf8'))
  assert.strictEqual(settings.env.SECURITY_HOOKS_MODE, 'enforce')
  assert.strictEqual(settings.hooks.PreToolUse.length, 2)
  assert.strictEqual(settings.hooks.PostToolUse.length, 1)
  assert.ok(Object.values(settings.hooks).flat().every((e) => e.hooks[0].command === 'C:/node/node.exe'))
  const plain = install(sharedKit, claude, '--no-smoke-test')
  assert.match(plain.out, /already up to date/)
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(claude, 'settings.json'), 'utf8')).env.SECURITY_HOOKS_MODE, 'enforce')
})

test('invalid input aborts before any write', () => {
  const claude = newClaudeDir()
  fs.writeFileSync(path.join(claude, 'settings.json'), '{ not json')
  const before = snapshot(claude)
  const bad = install(sharedKit, claude)
  assert.strictEqual(bad.code, 1)
  assert.deepStrictEqual(snapshot(claude), before)
  assert.strictEqual(install(sharedKit, path.join(tmp, 'does-not-exist')).code, 1)
  assert.strictEqual(install(sharedKit, path.join(sharedKit, 'sub')).code, 1)
  assert.strictEqual(install(sharedKit, claude, '--bogus').code, 1)
  assert.strictEqual(install(sharedKit, claude, '--hooks-mode', 'loud').code, 1)
  for (const removed of ['--with-third-party', '--with-plugin-files', '--with-curated', '--include-unreviewed']) {
    const r = install(sharedKit, claude, removed)
    assert.strictEqual(r.code, 1, removed)
    assert.match(r.err, /was removed: the full reviewed set is always installed/)
  }
  assert.strictEqual(install(sharedKit, claude, '--pin-reviewed', '--offline').code, 1)
  assert.strictEqual(install(sharedKit, claude, '--latest', '--offline').code, 1)
  assert.strictEqual(install(sharedKit, claude, '--latest', '--pin-reviewed').code, 1)
})

test('a failure while copying rolls everything back', () => {
  const mod = require('./install.cjs')
  const claude = newClaudeDir()
  fs.mkdirSync(path.join(claude, 'keep'), { recursive: true })
  fs.writeFileSync(path.join(claude, 'keep', 'x.txt'), 'x')
  const plan = mod.buildPlan({ kitRoot: realKit, claudeDir: claude, manifest: null })
  const existingTarget = path.join(claude, plan[3].rel)
  fs.mkdirSync(path.dirname(existingTarget), { recursive: true })
  fs.writeFileSync(existingTarget, 'pre-existing content')
  plan[3].action = 'overwrite'
  let calls = 0
  const ops = { copyFile: (src, dest) => { calls += 1; if (calls === 6) throw new Error('disk full'); fs.copyFileSync(src, dest) } }
  const backup = path.join(claude, '.backup-test')
  assert.throws(() => mod.applyFiles(plan, claude, backup, ops), /disk full/)
  const after = snapshot(claude)
  assert.strictEqual(after[plan[3].rel.replace(/\\/g, '/')], 'pre-existing content')
  assert.deepStrictEqual(Object.keys(after).filter((k) => !k.startsWith('.backup-test/')).sort(), ['keep/x.txt', plan[3].rel.replace(/\\/g, '/')].sort())
})

test('uninstall dry run changes nothing; apply removes only kit files and entries', () => {
  const claude = newClaudeDir(existingSettings())
  fs.mkdirSync(path.join(claude, 'skills', 'mine'), { recursive: true })
  fs.writeFileSync(path.join(claude, 'skills', 'mine', 'SKILL.md'), 'mine')
  install(sharedKit, claude)
  const installed = snapshot(claude)
  const dry = install(sharedKit, claude, '--uninstall', '--dry-run')
  assert.strictEqual(dry.code, 0)
  assert.match(dry.out, /DRY RUN/)
  assert.deepStrictEqual(snapshot(claude), installed)
  const done = install(sharedKit, claude, '--uninstall')
  assert.strictEqual(done.code, 0, done.out + done.err)
  const after = snapshot(claude)
  assert.strictEqual(after['skills/mine/SKILL.md'], 'mine')
  assert.ok(!Object.keys(after).some((k) => k.startsWith('security-kb/') || k.startsWith('hooks/security-kit/') || k.startsWith('skills/security-kit/') || k.startsWith('agents/security-reviewer')))
  assert.ok(!('.agent-security-kit-manifest.json' in after))
  assert.deepStrictEqual(JSON.parse(after['settings.json']), existingSettings())
})

test('uninstall keeps files you edited unless forced', () => {
  const claude = newClaudeDir()
  install(sharedKit, claude)
  fs.appendFileSync(path.join(claude, 'security-kb', 'INDEX.md'), 'my edit\n')
  const r = install(sharedKit, claude, '--uninstall')
  assert.strictEqual(r.code, 0)
  assert.ok(fs.existsSync(path.join(claude, 'security-kb', 'INDEX.md')))
  assert.ok(fs.existsSync(path.join(claude, '.agent-security-kit-manifest.json')))
  const forced = install(sharedKit, claude, '--uninstall', '--force')
  assert.strictEqual(forced.code, 0)
  assert.ok(!fs.existsSync(path.join(claude, 'security-kb', 'INDEX.md')))
})

test('uninstall without a manifest does nothing', () => {
  const claude = newClaudeDir()
  const r = install(sharedKit, claude, '--uninstall')
  assert.strictEqual(r.code, 0)
  assert.match(r.out, /Nothing to uninstall/)
})

test('an offline install keeps the third-party ownership records of an earlier install', () => {
  const claude = newClaudeDir()
  assert.strictEqual(install(sharedKit, claude).code, 0)
  const file = path.join(claude, '.agent-security-kit-manifest.json')
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'))
  manifest.thirdParty = [{ id: 'example', repo: 'https://example.test/r', license: 'MIT', sha: 'a', reviewedSha: 'a', mode: 'reviewed', note: '', paths: ['skills/example'], hashes: { 'skills/example': 'x' } }]
  fs.writeFileSync(file, JSON.stringify(manifest))
  assert.strictEqual(install(sharedKit, claude).code, 0)
  assert.deepStrictEqual(JSON.parse(fs.readFileSync(file, 'utf8')).thirdParty, manifest.thirdParty)
})

test('a failed third-party download restores updated and removed kit files and leaves settings alone', () => {
  const kit = copyKit()
  const claude = newClaudeDir()
  assert.strictEqual(install(kit, claude).code, 0)
  const doc = path.join(claude, 'security-kb', 'core', 'patching-cadence.md')
  const gone = path.join(claude, 'security-kb', 'core', 'performance-vs-security.md')
  const before = fs.readFileSync(doc, 'utf8')
  const settingsBefore = fs.readFileSync(path.join(claude, 'settings.json'), 'utf8')
  fs.appendFileSync(path.join(kit, 'security-kb', 'core', 'patching-cadence.md'), '\nA newer line.\n')
  fs.rmSync(path.join(kit, 'security-kb', 'core', 'performance-vs-security.md'))
  const dead = 'http://127.0.0.1:9'
  const r = spawnSync(process.execPath, [path.join(kit, 'tools', 'install.cjs'), '--claude-dir', claude, '--pin-reviewed', '--no-smoke-test'], { encoding: 'utf8', env: { ...process.env, HTTPS_PROXY: dead, https_proxy: dead, ALL_PROXY: dead, all_proxy: dead } })
  assert.strictEqual(r.status, 1, r.stdout + r.stderr)
  assert.match(r.stderr, /third-party fetch failed, kit files rolled back/)
  assert.strictEqual(fs.readFileSync(doc, 'utf8'), before)
  assert.ok(fs.existsSync(gone))
  assert.strictEqual(fs.readFileSync(path.join(claude, 'settings.json'), 'utf8'), settingsBefore)
})

test('--offline skips third-party sources and says how to add them', () => {
  const claude = newClaudeDir()
  const r = install(sharedKit, claude)
  assert.strictEqual(r.code, 0, r.out + r.err)
  assert.match(r.out, /Third-party: skipped \(--offline\)/)
  assert.ok(!fs.existsSync(path.join(claude, 'skills', 'security-audit')))
})

test('the dry run lists the whole reviewed set with its mode and commit, and writes nothing', () => {
  const claude = newClaudeDir()
  const before = snapshot(claude)
  const r = install(sharedKit, claude, '--pin-reviewed', '--dry-run')
  assert.strictEqual(r.code, 0, r.err)
  assert.match(r.out, /cloudflare-security-audit \[MIT\]: reviewed [0-9a-f]{12}/)
  assert.match(r.out, /trailofbits-skills \[CC-BY-SA-4\.0\]: reviewed [0-9a-f]{12}/)
  for (const p of ['skills/security-audit', 'skills/owasp-security', 'skills/differential-review', 'skills/fp-check', 'agents/adversarial-modeler.md', 'security-kb/third-party/insecure-defaults']) {
    assert.ok(r.out.includes(p), p)
  }
  assert.ok(!/curated|plugins-local/.test(r.out))
  assert.deepStrictEqual(snapshot(claude), before)
})

test('an existing third-party path that this kit does not own is a conflict', () => {
  const claude = newClaudeDir()
  fs.mkdirSync(path.join(claude, 'skills', 'security-audit'), { recursive: true })
  fs.writeFileSync(path.join(claude, 'skills', 'security-audit', 'SKILL.md'), 'mine')
  const r = install(sharedKit, claude, '--pin-reviewed', '--dry-run')
  assert.strictEqual(r.code, 2)
  assert.match(r.out, /already exists/)
  assert.match(r.out, /Conflicts/)
})

test('a real install fetches the reviewed set, patches it, updates cleanly, and protects edits', needsNetwork, () => {
  const claude = newClaudeDir(existingSettings())
  const first = install(sharedKit, claude, '--pin-reviewed')
  assert.strictEqual(first.code, 0, first.out + first.err)
  const files = snapshot(claude)
  for (const rel of ['skills/security-audit/SKILL.md', 'skills/owasp-security/SKILL.md', 'skills/differential-review/SKILL.md', 'skills/sharp-edges/SKILL.md', 'skills/audit-context-building/SKILL.md', 'skills/variant-analysis/SKILL.md', 'skills/fp-check/SKILL.md', 'agents/adversarial-modeler.md', 'agents/poc-builder.md', 'security-kb/third-party/insecure-defaults/weak-crypto.md']) {
    assert.ok(rel in files, rel)
  }
  assert.ok(!Object.keys(files).some((k) => /(^|\/)(hooks\.json|plugin\.json)$/.test(k) || k.includes('/workflows/') || k.includes('/tests/') || k.includes('/evals/')))
  assert.ok(!Object.keys(files).some((k) => k.endsWith('.test.cjs')))
  assert.match(files['agents/poc-builder.md'], /^tools: Read, Grep, Glob$/m)
  assert.ok(!/differential-review:adversarial-modeler/.test(files['skills/differential-review/SKILL.md']))
  assert.ok(!/^allowed-tools:.*Workflow/m.test(files['skills/audit-context-building/SKILL.md']))
  const manifest = JSON.parse(files['.agent-security-kit-manifest.json'])
  assert.strictEqual(manifest.thirdParty.length, 3)
  for (const tp of manifest.thirdParty) {
    assert.strictEqual(tp.mode, 'reviewed')
    assert.strictEqual(tp.sha, tp.reviewedSha)
    assert.ok(Object.values(tp.hashes).every((h) => /^[0-9a-f]{64}$/.test(h)))
  }

  const again = install(sharedKit, claude, '--pin-reviewed')
  assert.strictEqual(again.code, 0, again.out + again.err)
  assert.match(again.out, /\(update\)/)

  fs.appendFileSync(path.join(claude, 'skills', 'owasp-security', 'SKILL.md'), '\nmy note\n')
  assert.strictEqual(install(sharedKit, claude, '--pin-reviewed', '--dry-run').code, 2)
  const kept = install(sharedKit, claude, '--uninstall')
  assert.strictEqual(kept.code, 0, kept.out + kept.err)
  assert.match(kept.out, /modified\s+skills\/owasp-security/)
  assert.ok(fs.existsSync(path.join(claude, 'skills', 'owasp-security', 'SKILL.md')))
  assert.ok(!fs.existsSync(path.join(claude, 'skills', 'security-audit')))
  assert.ok(!fs.existsSync(path.join(claude, 'agents', 'adversarial-modeler.md')))
  const forced = install(sharedKit, claude, '--uninstall', '--force')
  assert.strictEqual(forced.code, 0)
  assert.ok(!fs.existsSync(path.join(claude, 'skills', 'owasp-security')))
})

test('parseArgs defaults to the home .claude directory and a real install', () => {
  const { parseArgs } = require('./install.cjs')
  const args = parseArgs([])
  assert.strictEqual(args.claudeDir, path.join(os.homedir(), '.claude'))
  assert.strictEqual(args.dryRun, false)
  assert.strictEqual(args.apply, true)
  assert.strictEqual(args.hooksMode, 'warn')
  assert.strictEqual(args.pinReviewed, true)
  assert.strictEqual(parseArgs(['--latest']).pinReviewed, false)
})

test('running with no flags installs, and --dry-run on a second target changes nothing', () => {
  const claude = newClaudeDir()
  const r = install(sharedKit, claude)
  assert.strictEqual(r.code, 0, r.out + r.err)
  assert.ok(!/DRY RUN/.test(r.out))
  assert.ok(fs.existsSync(path.join(claude, 'skills', 'security-kit', 'SKILL.md')))
  const other = newClaudeDir()
  assert.strictEqual(install(sharedKit, other, '--dry-run').code, 0)
  assert.deepStrictEqual(snapshot(other), {})
})

test('--apply is rejected with a pointer to --dry-run', () => {
  const claude = newClaudeDir()
  const r = install(sharedKit, claude, '--apply')
  assert.strictEqual(r.code, 1)
  assert.match(r.err, /--apply was removed/)
  assert.match(r.err, /--dry-run/)
  assert.deepStrictEqual(snapshot(claude), {})
})

test('--dry-run previews an install-time conflict without touching files and exits 2', () => {
  const claude = newClaudeDir()
  fs.mkdirSync(path.join(claude, 'agents'), { recursive: true })
  fs.writeFileSync(path.join(claude, 'agents', 'security-reviewer.md'), 'mine')
  const r = install(sharedKit, claude, '--dry-run')
  assert.strictEqual(r.code, 2)
  assert.match(r.out, /DRY RUN/)
  assert.deepStrictEqual(snapshot(claude), { 'agents/security-reviewer.md': 'mine' })
})

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }))
