const { compiled, readInput, collectStrings, scan, report } = require('./lib.cjs')

const input = readInput()
if (!input || !input.tool_input) process.exit(0)

// The description is prose written for the user; only what the shell will run is checked.
const { description, ...runnable } = input.tool_input
const command = collectStrings(runnable).join('\n')
const ids = [...new Set([...scan(compiled.bash, command), ...scan(compiled.shellSecrets, command)])]
process.exit(report('guard-bash', ids, 'shell command'))
