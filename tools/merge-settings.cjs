const fs = require('fs')
const path = require('path')

const KIT_PATH = /[\\/]hooks[\\/]security(-kit)?[\\/]/
const LEGACY_KIT_PATH = /[\\/]hooks[\\/]security[\\/]/

const readJson = (file) => {
  const raw = fs.readFileSync(file, 'utf8')
  return {
    data: JSON.parse(raw),
    eol: raw.includes('\r\n') ? '\r\n' : '\n',
    indent: (raw.match(/^([ \t]+)\S/m) || [])[1] || '  ',
    trailingNewline: raw.endsWith('\n')
  }
}

const entryKey = (entry) => `${entry.matcher || ''}|${(entry.hooks || []).map((h) => [h.command, ...(h.args || [])].join(' ')).join(';')}`

const matchesPath = (entry, re) => (entry.hooks || []).some((h) => (h.args || []).some((a) => re.test(a)))

const isKitEntry = (entry) => matchesPath(entry, KIT_PATH)

const isLegacyEntry = (entry) => matchesPath(entry, LEGACY_KIT_PATH)

const resolvePatch = (patch, kitDir) => JSON.parse(JSON.stringify(patch).split('__KIT_DIR__').join(kitDir.replace(/\\/g, '/')))

const merge = (settings, patch, kitDir) => {
  const resolved = resolvePatch(patch, kitDir)
  const out = JSON.parse(JSON.stringify(settings))
  const added = []
  if (resolved.env) {
    out.env = { ...resolved.env, ...(out.env || {}) }
    Object.keys(resolved.env).forEach((k) => {
      if (!(settings.env && k in settings.env)) added.push(`env.${k}`)
    })
  }
  for (const [event, entries] of Object.entries(resolved.hooks || {})) {
    out.hooks = out.hooks || {}
    const existing = out.hooks[event] || []
    out.hooks[event] = existing.filter((entry) => !isLegacyEntry(entry))
    const migrated = existing.length - out.hooks[event].length
    if (migrated) added.push(`hooks.${event} (migrated ${migrated} entr${migrated === 1 ? 'y' : 'ies'} from hooks/security to hooks/security-kit)`)
    for (const entry of entries) {
      if (out.hooks[event].some((existing) => entryKey(existing) === entryKey(entry))) continue
      out.hooks[event].push(entry)
      added.push(`hooks.${event}[${entry.matcher || '*'}]`)
    }
  }
  return { settings: out, added }
}

const remove = (settings) => {
  const out = JSON.parse(JSON.stringify(settings))
  const removed = []
  for (const event of Object.keys(out.hooks || {})) {
    const kept = out.hooks[event].filter((entry) => !isKitEntry(entry))
    for (let i = 0; i < out.hooks[event].length - kept.length; i++) removed.push(`hooks.${event}`)
    if (kept.length) out.hooks[event] = kept
    else delete out.hooks[event]
  }
  if (out.hooks && Object.keys(out.hooks).length === 0) delete out.hooks
  if (out.env && 'SECURITY_HOOKS_MODE' in out.env) {
    delete out.env.SECURITY_HOOKS_MODE
    removed.push('env.SECURITY_HOOKS_MODE')
    if (Object.keys(out.env).length === 0) delete out.env
  }
  return { settings: out, removed }
}

const serialize = (data, meta) => {
  const text = JSON.stringify(data, null, meta.indent) + (meta.trailingNewline ? '\n' : '')
  return meta.eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text
}

const parseArgs = (argv) => {
  const args = { apply: false, remove: false, settings: null, patch: path.join(__dirname, '..', 'settings.patch.json'), kitDir: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') args.apply = true
    else if (a === '--remove') args.remove = true
    else if (a === '--settings') args.settings = argv[++i]
    else if (a === '--patch') args.patch = argv[++i]
    else if (a === '--kit-dir') args.kitDir = argv[++i]
    else throw new Error(`unknown argument: ${a}`)
  }
  return args
}

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  if (!args.settings) throw new Error('--settings <file> is required')
  if (!args.remove && !args.kitDir) throw new Error('--kit-dir <directory> is required to merge')
  const current = readJson(args.settings)
  const result = args.remove ? remove(current.data) : merge(current.data, JSON.parse(fs.readFileSync(args.patch, 'utf8')), args.kitDir)
  const changes = args.remove ? result.removed : result.added
  console.log(changes.length ? `${args.remove ? 'Would remove' : 'Would add'}:\n  ${changes.join('\n  ')}` : 'No changes needed.')
  if (!args.apply || changes.length === 0) return
  const backup = `${args.settings}.bak-${Date.now()}`
  fs.copyFileSync(args.settings, backup)
  fs.writeFileSync(args.settings, serialize(result.settings, current))
  console.log(`Applied. Backup: ${backup}`)
}

module.exports = { merge, remove, readJson, serialize, isKitEntry, parseArgs }

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`merge-settings: ${error.message}`)
    process.exit(1)
  }
}
