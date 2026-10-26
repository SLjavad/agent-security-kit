const fs = require('fs')
const path = require('path')
const { compiled, readInput, isExcludedPath, scan, scanDrift, report } = require('./lib.cjs')

const MAX_BYTES = 1024 * 1024

const input = readInput()
const file = input && input.tool_input && typeof input.tool_input.file_path === 'string' ? input.tool_input.file_path : ''
if (!file || isExcludedPath(file)) process.exit(0)

let text
try {
  if (fs.statSync(file).size > MAX_BYTES) process.exit(0)
  text = fs.readFileSync(file, 'utf8')
} catch {
  process.exit(0)
}
if (text.includes('\u0000')) process.exit(0)

const ids = [...scan(compiled.secrets, text), ...scanDrift(file, text)]

process.exit(report('post-edit-scan', ids, path.basename(file), 'flagged'))
