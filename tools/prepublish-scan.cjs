const fs = require('fs')
const path = require('path')

const SKIP_DIRS = new Set(['.git', 'node_modules'])
const MAX_BYTES = 2 * 1024 * 1024

const patterns = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'hooks', 'security', 'patterns.json'), 'utf8'))

const rules = [
  ...patterns.secrets.map((r) => ({ id: `secret:${r.id}`, re: new RegExp(r.regex, r.flags || '') })),
  { id: 'windows-user-path', re: /\b[A-Za-z]:[\\/]+Users[\\/]+(?!<|\{|%|\$|name\b|you\b|user\b|username\b)[\w.~-]+/i },
  { id: 'unix-home-path', re: /\/(?:home|Users)\/(?!<|\{|\$|name\b|you\b|user\b|username\b)[\w.-]+\//i },
  { id: 'email-address', re: /\b[\w.+-]+@(?!example\.(?:com|org|net)\b|users\.noreply\.github\.com\b)[\w-]+(?:\.[\w-]+)+\b/i },
  { id: 'internal-hostname', re: /\b[\w-]+\.(?:local|internal|corp|lan|intranet)\b/i },
  { id: 'private-ip', re: /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/ }
]

const loadTerms = (file) =>
  file
    ? fs.readFileSync(file, 'utf8').split(/\r?\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#'))
    : []

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), out)
    } else if (entry.isFile()) out.push(path.join(dir, entry.name))
  }
  return out
}

const TEST_FILE = /\.test\.cjs$/

const scanText = (text, terms, secretsOnly = false) => {
  const found = []
  const active = secretsOnly ? rules.filter((r) => r.id.startsWith('secret:')) : rules
  text.split(/\r?\n/).forEach((line, i) => {
    for (const r of active) if (r.re.test(line)) found.push({ line: i + 1, rule: r.id })
    terms.forEach((t, n) => {
      if (line.toLowerCase().includes(t.toLowerCase())) found.push({ line: i + 1, rule: `term#${n + 1}` })
    })
  })
  return found
}

const scanDir = (root, terms = []) => {
  const findings = []
  for (const file of walk(root)) {
    if (fs.statSync(file).size > MAX_BYTES) continue
    const text = fs.readFileSync(file, 'utf8')
    if (text.includes('\u0000')) continue
    scanText(text, terms, TEST_FILE.test(file)).forEach((f) => findings.push({ file: path.relative(root, file), ...f }))
  }
  return findings
}

const main = () => {
  const argv = process.argv.slice(2)
  const rootArg = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--terms')
  const termsIdx = argv.indexOf('--terms')
  const root = path.resolve(rootArg || path.join(__dirname, '..'))
  const terms = loadTerms(termsIdx >= 0 ? argv[termsIdx + 1] : null)
  const findings = scanDir(root, terms)
  findings.forEach((f) => console.log(`${f.file}:${f.line}\t${f.rule}`))
  console.log(findings.length === 0 ? `prepublish-scan: clean (${root})` : `prepublish-scan: ${findings.length} finding(s)`)
  process.exit(findings.length === 0 ? 0 : 1)
}

module.exports = { scanText, scanDir, loadTerms }

if (require.main === module) main()
