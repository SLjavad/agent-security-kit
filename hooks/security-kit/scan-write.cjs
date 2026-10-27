const path = require('path')
const { compiled, readInput, collectStrings, isExcludedPath, scan, report } = require('./lib.cjs')

const input = readInput()
if (!input || !input.tool_input) process.exit(0)

const withoutOldText = (value) => {
  if (Array.isArray(value)) return value.map(withoutOldText)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'old_string').map(([key, inner]) => [key, withoutOldText(inner)]))
}

const { file_path: filePath, ...content } = withoutOldText(input.tool_input)
const file = typeof filePath === 'string' ? filePath : ''
if (isExcludedPath(file)) process.exit(0)

const ids = scan(compiled.secrets, collectStrings(content).join('\n'))
process.exit(report('scan-write', ids, path.basename(file) || 'content'))
