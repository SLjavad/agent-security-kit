const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const SHA = /^[0-9a-f]{40}$/
const REPO = /^https:\/\/(?:github\.com|gitlab\.com)\/[\w.-]+\/[\w.-]+$/
const REVIEW_RANK = { none: 0, partial: 1, full: 2 }

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

const git = (cwd, args) => execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })

const checkout = (source, dir) => {
  fs.mkdirSync(dir, { recursive: true })
  git(dir, ['init', '-q'])
  git(dir, ['remote', 'add', 'origin', `${source.repo}.git`])
  git(dir, ['fetch', '--depth', '1', '-q', 'origin', source.sha])
  git(dir, ['checkout', '-q', 'FETCH_HEAD'])
}

const apply = (source, target, force) => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'third-party-'))
  try {
    checkout(source, work)
    const written = []
    for (const inc of source.include) {
      const from = safeJoin(work, inc.from)
      const to = safeJoin(target, inc.to)
      if (!fs.existsSync(from)) throw new Error(`${source.id}: missing ${inc.from} at ${source.sha}`)
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
    return written
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

const parseArgs = (argv) => {
  const args = { only: null, target: null, apply: false, force: false, includeUnreviewed: false, includeOptional: false, list: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') args.apply = true
    else if (a === '--force') args.force = true
    else if (a === '--include-unreviewed') args.includeUnreviewed = true
    else if (a === '--include-optional') args.includeOptional = true
    else if (a === '--list') args.list = true
    else if (a === '--only') args.only = String(argv[++i] || '').split(',').filter(Boolean)
    else if (a === '--target') args.target = argv[++i]
    else throw new Error(`unknown argument: ${a}`)
  }
  return args
}

const select = (lock, args) =>
  lock.sources.filter((s) => (!args.only || args.only.includes(s.id)) && (args.includeUnreviewed || REVIEW_RANK[s.review] > 0) && (args.includeOptional || !s.optional))

const main = () => {
  const args = parseArgs(process.argv.slice(2))
  const lock = loadLock()
  if (args.list) {
    lock.sources.forEach((s) => console.log(`${s.id}\t${s.license}\treview=${s.review}${s.optional ? ' (optional)' : ''}\t${s.repo}@${s.sha.slice(0, 12)}\t${s.include.length} item(s)`))
    return
  }
  if (!args.target) throw new Error('--target <directory> is required')
  const chosen = select(lock, args)
  const skipped = lock.sources.filter((s) => !chosen.includes(s)).map((s) => s.id)
  console.log(`${args.apply ? 'Applying' : 'Plan (dry run, add --apply to fetch)'}: ${chosen.map((s) => s.id).join(', ') || 'nothing'}`)
  if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}`)
  if (!args.apply) {
    chosen.forEach((s) => s.include.forEach((i) => console.log(`  ${s.id}: ${i.from} -> ${i.to}`)))
    return
  }
  const manifest = []
  for (const source of chosen) {
    const written = apply(source, path.resolve(args.target), args.force)
    manifest.push({ id: source.id, repo: source.repo, sha: source.sha, license: source.license, review: source.review, paths: written, fetchedAt: new Date().toISOString() })
    console.log(`  ${source.id}: ${written.length} item(s)`)
  }
  fs.writeFileSync(path.join(path.resolve(args.target), '.third-party-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
}

module.exports = { safeJoin, validateSource, loadLock, setTools, parseArgs, select, apply, REVIEW_RANK }

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(`fetch-third-party: ${error.message}`)
    process.exit(1)
  }
}
