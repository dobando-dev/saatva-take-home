#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): format the edited file with the repo's pinned Prettier.
// Never fails the tool call; .prettierignore decides what is skipped.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

let raw = ''
for await (const chunk of process.stdin) raw += chunk

const input = JSON.parse(raw || '{}')
const target = input.tool_response?.filePath ?? input.tool_input?.file_path
if (!target) process.exit(0)

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd()
const prettier = path.join(projectDir, 'node_modules', '.bin', 'prettier')
const file = path.resolve(input.cwd ?? projectDir, target)

if (!existsSync(prettier) || !existsSync(file) || !file.startsWith(projectDir + path.sep)) {
  process.exit(0)
}

spawnSync(prettier, ['--write', '--ignore-unknown', '--log-level', 'warn', file], {
  cwd: projectDir,
  stdio: ['ignore', 'ignore', 'inherit'],
})
process.exit(0)
