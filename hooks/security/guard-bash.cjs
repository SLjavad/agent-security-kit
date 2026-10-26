const { compiled, readInput, collectStrings, scan, report } = require('./lib.cjs')

const input = readInput()
if (!input || !input.tool_input) process.exit(0)

const command = collectStrings(input.tool_input).join('\n')
process.exit(report('guard-bash', scan(compiled.bash, command), 'shell command'))
