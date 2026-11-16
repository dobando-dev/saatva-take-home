#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): block any change under services/upstream/.
// The README says the upstream services are third-party and must not be modified.
import path from 'node:path'

let raw = ''
for await (const chunk of process.stdin) raw += chunk

const input = JSON.parse(raw || '{}')
const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path
if (!target) process.exit(0)

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd()
const upstreamDir = path.resolve(projectDir, 'services/upstream') + path.sep
const resolved = path.resolve(input.cwd ?? projectDir, target)

if (resolved.startsWith(upstreamDir)) {
  console.error(
    'Blocked: services/upstream/ is a mock of third-party services we do not control (see README). ' +
      'Handle upstream quirks in the BFF (apps/api) instead.',
  )
  process.exit(2)
}
