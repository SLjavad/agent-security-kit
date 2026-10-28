const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const SHA = /^[0-9a-f]{40}$/
const REPO = /^https:\/\/(?:github\.com|gitlab\.com)\/[\w.-]+\/[\w.-]+$/
const REVIEW_RANK = { none: 0, partial: 1, full: 2 }
const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.json'])
const MAX_CHANGED_FILES = 200
const GATE_PATTERNS = [
  ['hidden or bidirectional Unicode', /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/],
  ['download piped into a shell', /\b(?:curl|wget|iwr|Invoke-WebRequest)\b[^\n]*\|\s*(?:ba|z)?sh\b|\|\s*(?:iex|Invoke-Expression)\b/i],
  ['instruction override phrase', /ignore (?:all |any )?(?:previous|prior|above) instructions|disregard (?:the )?(?:system|previous) prompt/i],
  ['long encoded blob', /[A-Za-z0-9+/]{200,}={0,2}/],
  ['tool or hook declaration changed', /^\+\s*(?:allowed-tools|tools|hooks|permissionMode|mcpServers|disable-model-invocation)\s*:/i]
]

const lockPath = path.join(__dirname, '..', 'third-party', 'lock.json')

const safeJoin = (root, rel) => {
  const base = path.resolve(root)
  const full = path.resolve(base, rel)
  if (full !== base && !full.startsWith(base + path.sep)) throw new Error(`path escapes its root: ${rel}`)
  return full
}

const validateSource = (source) => {
  if (!REPO.test(source.repo)) throw new Error(`${source.id}: repository URL not allowed`)
  if (!SHA.test(source.sha)) throw new Error(`${source.id}: sha must be 40 hex characters`)
  if (!(source.review in REVIEW_RANK)) throw new Error(`${source.id}: review must be none, partial, or full`)
  if (source.reviewedSha !== undefined && source.reviewedSha !== source.sha) {
    throw new Error(`${source.id}: the review was done at ${String(source.reviewedSha).slice(0, 12)} but the pin is ${source.sha.slice(0, 12)}; re-review before changing the pin`)
  }
  if (source.review !== 'none' && source.reviewedSha === undefined) throw new Error(`${source.id}: a reviewed source must record reviewedSha`)
  const probe = path.join(os.tmpdir(), 'probe')
  for (const inc of source.include || []) {
    safeJoin(probe, inc.from)
    safeJoin(probe, inc.to)
  }
  for (const rel of source.remove || []) safeJoin(probe, rel)
  for (const rel of source.removeEach || []) safeJoin(probe, rel)
  for (const t of source.setTools || []) safeJoin(probe, t.file)
  for (const r of source.replace || []) {
    safeJoin(probe, r.file)
    if (typeof r.find !== 'string' || r.find.length === 0 || typeof r.with !== 'string') throw new Error(`${source.id}: replace entry for ${r.file} needs find and with`)
  }
}

const loadLock = (file = lockPath) => {
  const lock = JSON.parse(fs.readFileSync(file, 'utf8'))
  lock.sources.forEach(validateSource)
  return lock
}

const setTools = (file, tools) => {
  const text = fs.readFileSync(file, 'utf8')
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) throw new Error(`no front matter in ${file}`)
  const updated = match[1].replace(/^tools:[^\n]*(?:\r?\n[ \t]+-[^\n]*)*/m, () => `tools: ${tools.join(', ')}`)
  if (updated === match[1] && !/^tools:/m.test(match[1])) throw new Error(`no tools entry in ${file}`)
  fs.writeFileSync(file, text.replace(match[1], () => updated))
}

const replaceText = (file, find, replacement, count = 1) => {
  const raw = fs.readFileSync(file, 'utf8')
  const crlf = raw.includes('\r\n')
  const text = raw.replace(/\r\n/g, '\n')
  const parts = text.split(find.replace(/\r\n/g, '\n'))
  if (parts.length - 1 !== count) throw new Error(`patch does not apply to ${path.basename(file)}: expected ${count} match(es), found ${parts.length - 1}`)
  const out = parts.join(replacement)
  fs.writeFileSync(file, crlf ? out.replace(/\n/g, '\r\n') : out)
}

const git = (cwd, args) => execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })

const remoteHead = (source) => {
  const out = execFileSync('git', ['ls-remote', `${source.repo}.git`, 'HEAD'], { stdio: 'pipe', encoding: 'utf8', timeout: 60000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  const sha = out.split(/\s/)[0]
  if (!SHA.test(sha)) throw new Error(`could not resolve the default branch of ${source.repo}`)
  return sha
}

const checkout = (source, dir, shas) => {
  fs.mkdirSync(dir, { recursive: true })
  git(dir, ['init', '-q'])
  git(dir, ['config', 'core.autocrlf', 'false'])
  git(dir, ['remote', 'add', 'origin', `${source.repo}.git`])
  for (const sha of shas) git(dir, ['fetch', '--depth', '1', '-q', 'origin', sha])
  git(dir, ['checkout', '-q', shas[0]])
}

const under = (p, base) => p === base || p.startsWith(`${base}/`)

const relevant = (source, file) =>
  source.include.some((i) => {
    if (!under(file, i.from)) return false
    const rel = file.slice(i.from.length + 1)
    const installed = rel ? `${i.to}/${rel}` : i.to
    return !(source.removeEach || []).some((r) => rel && under(rel, r)) && !(source.remove || []).some((r) => under(installed, r))
  })

const gateChanges = (source, repoDir, from, to) => {
  const reasons = []
  const raw = git(repoDir, ['diff', '--raw', '--no-renames', from, to]).split('\n').filter(Boolean)
  const changes = raw.map((line) => {
    const [meta, file] = line.split('\t')
    const [, newMode, , , status] = meta.split(' ')
    return { file, newMode, status }
  }).filter((c) => relevant(source, c.file))
  if (changes.length > MAX_CHANGED_FILES) reasons.push(`${changes.length} files changed under the installed paths`)
  for (const c of changes) {
    if (c.status === 'D') continue
    if (c.newMode === '120000') reasons.push(`${c.file}: is a symbolic link`)
    else if (c.newMode === '100755') reasons.push(`${c.file}: is executable`)
    else if (!DOC_EXTENSIONS.has(path.extname(c.file).toLowerCase())) reasons.push(`${c.file}: ${c.status === 'A' ? 'new' : 'changed'} file of a type that is not plain documentation`)
  }
  if (reasons.length === 0 && changes.length > 0) {
    const paths = [...new Set(changes.map((c) => c.file))]
    const added = git(repoDir, ['diff', '-U0', '--no-color', from, to, '--', ...paths]).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    for (const [name, re] of GATE_PATTERNS) if (added.some((l) => re.test(l))) reasons.push(`added text matches: ${name}`)
  }
  return { reasons, changed: changes.length }
}

const firstLine = (error) => error.message.split('\n')[0]

const compareUpstream = (source) => {
  let head
  try {
    head = remoteHead(source)
  } catch (error) {
    return { state: 'unreachable', error: firstLine(error) }
  }
  if (head === source.sha) return { state: 'unchanged', head }
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'third-party-gate-'))
  try {
    checkout(source, work, [head, source.sha])
    const gate = gateChanges(source, work, source.sha, head)
    return { state: 'moved', head, changed: gate.changed, reasons: gate.reasons }
  } catch (error) {
    return { state: 'error', head, error: firstLine(error) }
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

const resolve = (source, { pinReviewed = true } = {}) => {
  const reviewed = { sha: source.sha, mode: 'reviewed', note: null }
  if (pinReviewed) return { ...reviewed, note: 'pinned to the reviewed commit' }
  const upstream = compareUpstream(source)
  const fallback = (note, extra = {}) => ({ ...reviewed, mode: 'reviewed-fallback', note, ...extra })
  if (upstream.state === 'unreachable') return fallback(`upstream unreachable (${upstream.error}); the reviewed commit will be fetched`)
  if (upstream.state === 'unchanged') return { ...reviewed, note: 'upstream has not changed since the review' }
  if (upstream.state === 'error') return fallback(`could not compare with upstream (${upstream.error}); the reviewed commit will be fetched`)
  const { head, reasons } = upstream
  if (reasons.length) return fallback(`upstream moved to ${head.slice(0, 12)} but the automatic check refused it: ${reasons.slice(0, 4).join('; ')}${reasons.length > 4 ? ` (+${reasons.length - 4} more)` : ''}`, { latest: head, reasons })
  return { sha: head, mode: 'latest', note: `upstream moved ${source.sha.slice(0, 12)} -> ${head.slice(0, 12)}; ${upstream.changed} documentation file(s) changed and the automatic check found nothing`, reasons: [] }
}

const copyAndPatch = (source, work, target, force) => {
  const written = []
  for (const inc of source.include) {
    const from = safeJoin(work, inc.from)
    const to = safeJoin(target, inc.to)
    if (!fs.existsSync(from)) throw new Error(`${source.id}: missing ${inc.from}`)
    if (fs.existsSync(to)) {
      if (!force) throw new Error(`${source.id}: ${inc.to} already exists, use --force to replace it`)
      fs.rmSync(to, { recursive: true, force: true })
    }
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.cpSync(from, to, { recursive: true, filter: (p) => path.basename(p) !== '.git' })
    for (const rel of source.removeEach || []) fs.rmSync(path.join(to, rel), { recursive: true, force: true })
    written.push(inc.to)
  }
  for (const rel of source.remove || []) fs.rmSync(safeJoin(target, rel), { recursive: true, force: true })
  for (const t of source.setTools || []) setTools(safeJoin(target, t.file), t.tools)
  for (const r of source.replace || []) replaceText(safeJoin(target, r.file), r.find, r.with, r.count || 1)
  return written
}

const apply = (source, target, force, resolved = { sha: source.sha, mode: 'reviewed' }) => {
  const attempt = (sha) => {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'third-party-'))
    const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'third-party-stage-'))
    try {
      checkout(source, work, [sha])
      const staged = copyAndPatch(source, work, staging, false)
      for (const rel of staged) {
        const to = safeJoin(target, rel)
        if (fs.existsSync(to)) {
          if (!force) throw new Error(`${source.id}: ${rel} already exists, use --force to replace it`)
          fs.rmSync(to, { recursive: true, force: true })
        }
        fs.mkdirSync(path.dirname(to), { recursive: true })
        fs.cpSync(safeJoin(staging, rel), to, { recursive: true })
      }
      return staged
    } finally {
      fs.rmSync(work, { recursive: true, force: true })
      fs.rmSync(staging, { recursive: true, force: true })
    }
  }
  try {
    return { paths: attempt(resolved.sha), sha: resolved.sha, mode: resolved.mode, note: resolved.note || null }
  } catch (error) {
    if (resolved.sha === source.sha || /already exists/.test(error.message)) throw error
    return { paths: attempt(source.sha), sha: source.sha, mode: 'reviewed-fallback', note: `latest commit ${resolved.sha.slice(0, 12)} did not install cleanly (${error.message.split('\n')[0]}); reviewed commit used` }
  }
}

const parseArgs = (argv) => {
  const args = { only: null, target: null, apply: false, force: false, list: false, pinReviewed: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') args.apply = true
    else if (a === '--force') args.force = true
    else if (a === '--pin-reviewed') args.pinReviewed = true
    else if (a === '--latest') args.pinReviewed = false
    else if (a === '--list') args.list = true
    else if (a === '--only') args.only = String(argv[++i] || '').split(',').filter(Boolean)
    else if (a === '--target') args.target = argv[++i]
    else throw new Error(`unknown argument: ${a}`)
  }
  return args
}

const select = (lock, args = {}) => lock.sources.filter((s) => (!args.only || args.only.includes(s.id)) && REVIEW_RANK[s.review] > 0)

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const lock = loadLock()
  if (args.list) {
    lock.sources.forEach((s) => console.log(`${s.id}\t${s.license}\treview=${s.review}\t${s.repo}\treviewed ${s.sha.slice(0, 12)}\t${s.include.length} item(s)`))
    return
  }
  if (!args.target) throw new Error('--target <directory> is required')
  const chosen = select(lock, args)
  console.log(`${args.apply ? 'Applying' : 'Plan (dry run, add --apply to fetch)'}: ${chosen.map((s) => s.id).join(', ') || 'nothing'}`)
  const manifest = []
  for (const source of chosen) {
    const resolved = resolve(source, args)
    console.log(`  ${source.id}: ${resolved.mode} ${resolved.sha.slice(0, 12)} (${resolved.note})`)
    if (!args.apply) {
      source.include.forEach((i) => console.log(`    ${i.from} -> ${i.to}`))
      continue
    }
    const result = apply(source, path.resolve(args.target), args.force, resolved)
    manifest.push({ id: source.id, repo: source.repo, sha: result.sha, reviewedSha: source.sha, mode: result.mode, license: source.license, review: source.review, paths: result.paths, fetchedAt: new Date().toISOString() })
  }
  if (args.apply) fs.writeFileSync(path.join(path.resolve(args.target), '.third-party-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
}

module.exports = { safeJoin, validateSource, loadLock, setTools, replaceText, parseArgs, select, resolve, compareUpstream, apply, gateChanges, REVIEW_RANK, GATE_PATTERNS }

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`fetch-third-party: ${error.message}`)
    process.exit(1)
  }
}
