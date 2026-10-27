const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

const patterns = JSON.parse(fs.readFileSync(path.join(__dirname, 'patterns.json'), 'utf8'))

const compile = (rule) => new RegExp(rule.regex, rule.flags || '')

const compileDrift = (rule) => {
  const base = { id: rule.id, files: new RegExp(rule.files, 'i') }
  if (rule.regex) return { ...base, re: compile(rule) }
  if (!rule.count) throw new Error(`drift rule ${rule.id} needs regex or count`)
  return {
    ...base,
    extract: rule.extract ? new RegExp(rule.extract, rule.extractFlags || '') : null,
    count: new RegExp(rule.count, `${rule.countFlags || ''}g`),
    min: rule.min || 1,
    absent: rule.absent ? new RegExp(rule.absent, rule.absentFlags || '') : null
  }
}

const kbDir = () => process.env.SECURITY_KB_DIR || path.join(__dirname, '..', '..', 'security-kb')

const loadStackDriftRules = () => {
  const stacksDir = path.join(kbDir(), 'stacks')
  let entries = []
  try {
    entries = fs.readdirSync(stacksDir, { withFileTypes: true })
  } catch {
    return []
  }
  const rules = []
  for (const entry of entries) {
    if (!entry.isDirectory() || /^[_.]/.test(entry.name)) continue
    try {
      const file = JSON.parse(fs.readFileSync(path.join(stacksDir, entry.name, 'hook-rules.json'), 'utf8'))
      for (const rule of file.configDrift || []) {
        try {
          rules.push(compileDrift(rule))
        } catch {
          continue
        }
      }
    } catch {
      continue
    }
  }
  return rules
}

const compiled = {
  secrets: patterns.secrets.map((r) => ({ id: r.id, re: compile(r) })),
  bash: patterns.bash.map((r) => ({ id: r.id, re: compile(r) })),
  configDrift: [...patterns.configDrift.map(compileDrift), ...loadStackDriftRules()],
  excludePaths: patterns.excludePaths.map((p) => new RegExp(p, 'i'))
}

const mode = () => (String(process.env.SECURITY_HOOKS_MODE || 'warn').toLowerCase() === 'enforce' ? 'enforce' : 'warn')

let projectDir = null

const readInput = () => {
  try {
    const input = JSON.parse(fs.readFileSync(0, 'utf8'))
    if (input && typeof input.cwd === 'string') projectDir = input.cwd
    return input
  } catch {
    return null
  }
}

const collectStrings = (value, out = []) => {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out))
  return out
}

const isExcludedPath = (file) => Boolean(file) && compiled.excludePaths.some((re) => re.test(file))

const scan = (rules, text) => rules.filter((r) => r.re.test(text)).map((r) => r.id)

const driftMatches = (rule, file, text) => {
  if (!rule.files.test(file)) return false
  if (rule.re) return rule.re.test(text)
  const block = rule.extract ? text.match(rule.extract) : [text, text]
  if (!block) return false
  const found = (block[1] === undefined ? block[0] : block[1]).match(rule.count) || []
  return found.length >= rule.min && !(rule.absent && rule.absent.test(text))
}

const scanDrift = (file, text) => compiled.configDrift.filter((r) => driftMatches(r, file, text)).map((r) => r.id)

const logRoot = () => process.env.SECURITY_HOOKS_LOG_DIR || path.join(os.homedir(), '.claude', 'hooks', 'security-kit', 'logs')

const maxLogBytes = () => Number(process.env.SECURITY_HOOKS_LOG_MAX_BYTES) || 1024 * 1024

const projectRoot = (start) => {
  let dir = path.resolve(start)
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return path.resolve(start)
    dir = parent
  }
}

const projectKey = (cwd) => {
  if (!cwd) return '_unknown'
  const root = projectRoot(cwd)
  const identity = process.platform === 'win32' ? root.toLowerCase() : root
  const name = path.basename(root).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 40) || 'project'
  return `${name}-${crypto.createHash('sha256').update(identity).digest('hex').slice(0, 8)}`
}

const rotate = (file) => {
  if (fs.statSync(file).size < maxLogBytes()) return
  const backup = file.replace(/\.jsonl$/, '.1.jsonl')
  fs.rmSync(backup, { force: true })
  fs.renameSync(file, backup)
}

const logFinding = (hook, rule, target) => {
  try {
    const dir = path.join(logRoot(), projectKey(projectDir))
    const file = path.join(dir, 'findings.jsonl')
    fs.mkdirSync(dir, { recursive: true })
    if (fs.existsSync(file)) rotate(file)
    fs.appendFileSync(file, JSON.stringify({ t: new Date().toISOString(), hook, rule, target }) + '\n')
  } catch {
    return
  }
}

const report = (hook, ids, target, verb = 'blocked') => {
  if (ids.length === 0) return 0
  ids.forEach((id) => logFinding(hook, id, target))
  if (mode() !== 'enforce') return 0
  process.stderr.write(`security-hook ${hook}: ${verb} by rule(s) ${ids.join(', ')} for ${target}. Remove the value or move it to a secret store.\n`)
  return 2
}

module.exports = { compiled, mode, readInput, collectStrings, isExcludedPath, scan, scanDrift, report, projectKey }
