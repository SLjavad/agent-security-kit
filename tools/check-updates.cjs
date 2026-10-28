const fs = require('fs')
const path = require('path')
const fetcher = require('./fetch-third-party.cjs')

const FEED_URL = 'https://builds.dotnet.microsoft.com/dotnet/release-metadata/releases-index.json'
const DEFAULT_MAX_AGE_MONTHS = 6
const AREAS = ['third-party', 'dotnet', 'stacks']
const SUPPORTED_PHASES = new Set(['active', 'maintenance'])
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const kitRoot = path.join(__dirname, '..')

const item = (level, area, subject, text) => ({ level, area, subject, text })

const checkThirdParty = (lock, compare = fetcher.compareUpstream) =>
  fetcher.select(lock).map((source) => {
    const reviewed = source.sha.slice(0, 12)
    const upstream = compare(source)
    if (upstream.state === 'unchanged') return item('ok', 'third-party', source.id, `unchanged at ${reviewed}`)
    if (upstream.state === 'unreachable' || upstream.state === 'error') return item('error', 'third-party', source.id, `could not compare with upstream: ${upstream.error}`)
    const head = upstream.head.slice(0, 12)
    const link = `${source.repo}/compare/${reviewed}...${head}`
    if (upstream.reasons.length) return item('action', 'third-party', source.id, `upstream moved to ${head} and the automatic gate refused it (${upstream.reasons.slice(0, 3).join('; ')}); review by hand: ${link}`)
    if (upstream.changed === 0) return item('info', 'third-party', source.id, `upstream moved to ${head}, but no installed file changed, so there is nothing to review (${link})`)
    return item('action', 'third-party', source.id, `upstream moved to ${head}; ${upstream.changed} installed file(s) changed and the gate found nothing. Read the diff, then move sha and reviewedSha together in third-party/lock.json: ${link}`)
  })

const parseSupported = (text) => {
  const line = text.split(/\r?\n/).find((l) => /Listed as supported/i.test(l)) || ''
  return [...line.matchAll(/\.NET (\d+) \((LTS|STS)\) until ([A-Z][a-z]+) (\d{4})/g)].map((m) => ({ channel: `${m[1]}.0`, type: m[2], month: MONTHS.indexOf(m[3]) + 1, year: Number(m[4]) }))
}

const checkDotnet = ({ feed, cadenceText, templateText }) => {
  const releases = new Map(feed['releases-index'].map((r) => [r['channel-version'], r]))
  const documented = parseSupported(cadenceText)
  const items = []
  const action = (subject, text) => items.push(item('action', 'dotnet', subject, text))
  if (documented.length === 0) action('patching-cadence.md', 'no "Listed as supported" line with versions was found, so the support dates cannot be compared')
  for (const d of documented) {
    const subject = `.NET ${d.channel}`
    const release = releases.get(d.channel)
    if (!release) {
      action(subject, 'documented as supported but absent from the Microsoft release feed')
      continue
    }
    if (!SUPPORTED_PHASES.has(release['support-phase'])) action(subject, `documented as supported, but Microsoft lists it as ${release['support-phase']}`)
    const [year, month] = String(release['eol-date'] || '').split('-').map(Number)
    if (year !== d.year || month !== d.month) action(subject, `documented end of support is ${MONTHS[d.month - 1]} ${d.year}, the feed says ${release['eol-date']}`)
    if (String(release['release-type']).toUpperCase() !== d.type) action(subject, `documented as ${d.type}, the feed says ${String(release['release-type']).toUpperCase()}`)
  }
  for (const release of releases.values()) {
    if (SUPPORTED_PHASES.has(release['support-phase']) && !documented.some((d) => d.channel === release['channel-version'])) {
      action(`.NET ${release['channel-version']}`, `supported by Microsoft (${release['support-phase']}, end of support ${release['eol-date']}) but missing from patching-cadence.md`)
    }
  }
  const tag = templateText.match(/^\s*image:\s*\S*\/sdk:(\d+\.\d+)@sha256:/m)
  const tested = templateText.match(/SDK (\d+\.\d+\.\d+)/)
  if (!tag || !tested) {
    action('dependency-audit template', 'the SDK tag or the tested version could not be read from the template')
  } else {
    const release = releases.get(tag[1])
    if (!release) action('dependency-audit template', `the image uses SDK channel ${tag[1]}, which the feed does not list`)
    else if (!SUPPORTED_PHASES.has(release['support-phase'])) action('dependency-audit template', `the image uses SDK channel ${tag[1]}, which Microsoft lists as ${release['support-phase']}`)
    else if (release['latest-sdk'] !== tested[1]) action('dependency-audit template', `the pinned image was tested with SDK ${tested[1]}; Microsoft lists ${release['latest-sdk']} as the latest ${tag[1]} SDK. Refresh the digest (Dependabot proposes it) and the version in the template header`)
  }
  if (items.length === 0) items.push(item('ok', 'dotnet', 'lifecycle and SDK', `support dates match the Microsoft feed for ${documented.length} version(s) and the pinned SDK ${tested[1]} is the latest ${tag[1]} SDK`))
  return items
}

const checkStacks = (stacksDir, now, maxAgeMonths) => {
  const nowMonths = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1
  return fs.readdirSync(stacksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !/^[_.]/.test(d.name))
    .map((d) => {
      let verified
      try {
        verified = JSON.parse(fs.readFileSync(path.join(stacksDir, d.name, 'stack.json'), 'utf8')).verified
      } catch {
        return item('action', 'stacks', d.name, 'stack.json is missing or unreadable')
      }
      const m = /^(\d{4})-(\d{2})$/.exec(String(verified))
      if (!m) return item('action', 'stacks', d.name, `"verified" must look like 2026-10, found ${JSON.stringify(verified)}`)
      const age = nowMonths - (Number(m[1]) * 12 + Number(m[2]))
      if (age > maxAgeMonths) return item('action', 'stacks', d.name, `last verified ${verified}, ${age} months ago (limit ${maxAgeMonths}); re-check its facts against the sources in stack.json`)
      return item('ok', 'stacks', d.name, `verified ${verified}`)
    })
}

const fetchFeed = async () => {
  const response = await fetch(FEED_URL, { signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`the .NET release feed answered ${response.status}`)
  return response.json()
}

const guarded = async (area, items, produce) => {
  try {
    items.push(...(await produce()))
  } catch (error) {
    items.push(item('error', area, 'check', String(error.message).split('\n')[0]))
  }
}

const run = async ({ root = kitRoot, now = new Date(), only = AREAS, maxAgeMonths = DEFAULT_MAX_AGE_MONTHS, compare = fetcher.compareUpstream, feed = fetchFeed } = {}) => {
  const items = []
  const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8')
  if (only.includes('third-party')) await guarded('third-party', items, () => checkThirdParty(fetcher.loadLock(path.join(root, 'third-party', 'lock.json')), compare))
  if (only.includes('dotnet')) {
    await guarded('dotnet', items, async () => checkDotnet({
      feed: await feed(),
      cadenceText: read('security-kb', 'stacks', 'dotnet', 'patching-cadence.md'),
      templateText: read('security-kb', 'stacks', 'dotnet', 'templates', 'gitlab-ci-dependency-audit.yml')
    }))
  }
  if (only.includes('stacks')) await guarded('stacks', items, () => checkStacks(path.join(root, 'security-kb', 'stacks'), now, maxAgeMonths))
  return items
}

const exitCode = (items) => (items.some((i) => i.level === 'error') ? 1 : 0) | (items.some((i) => i.level === 'action') ? 2 : 0)

const LABEL = { ok: 'ok', info: 'info', action: 'ACTION', error: 'COULD NOT CHECK' }
const cell = (text) => String(text).replace(/\|/g, '\\|')

const buildReport = (items, now = new Date()) => {
  const actions = items.filter((i) => i.level === 'action').length
  const errors = items.filter((i) => i.level === 'error').length
  const lines = [`# Security kit update check (${now.toISOString().slice(0, 10)})`, '', `${actions} item(s) need review, ${errors} check(s) could not run.`]
  for (const area of AREAS) {
    const rows = items.filter((i) => i.area === area)
    if (rows.length === 0) continue
    lines.push('', `## ${{ 'third-party': 'Third-party skills', dotnet: '.NET', stacks: 'Stacks' }[area]}`, '', '| Subject | Status | Detail |', '|---|---|---|')
    for (const r of rows) lines.push(`| ${cell(r.subject)} | ${LABEL[r.level]} | ${cell(r.text)} |`)
  }
  return lines.join('\n') + '\n'
}

const parseArgs = (argv) => {
  const args = { only: AREAS, maxAgeMonths: DEFAULT_MAX_AGE_MONTHS }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--only') {
      args.only = String(argv[++i] || '').split(',').filter(Boolean)
      const unknown = args.only.filter((x) => !AREAS.includes(x))
      if (args.only.length === 0 || unknown.length) throw new Error(`--only takes ${AREAS.join(', ')}`)
    } else if (a === '--max-age-months') {
      args.maxAgeMonths = Number(argv[++i])
      if (!Number.isInteger(args.maxAgeMonths) || args.maxAgeMonths < 0) throw new Error('--max-age-months takes a whole number')
    } else throw new Error(`unknown argument: ${a}`)
  }
  return args
}

module.exports = { checkThirdParty, checkDotnet, checkStacks, parseSupported, parseArgs, run, buildReport, exitCode }

if (require.main === module) {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`check-updates: ${error.message}`)
    process.exit(1)
  }
  run(args).then((items) => {
    process.stdout.write(buildReport(items))
    process.exitCode = exitCode(items)
  }, (error) => {
    console.error(`check-updates: ${error.message}`)
    process.exit(1)
  })
}
