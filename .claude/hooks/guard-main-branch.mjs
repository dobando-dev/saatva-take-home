#!/usr/bin/env node
// PreToolUse (Bash): block git commit / merge / rebase / push while main (or master) is checked out,
// and block commands that switch to main and then commit in one go. Work happens on feature branches.
import { execFileSync } from 'node:child_process'

let raw = ''
for await (const chunk of process.stdin) raw += chunk

const input = JSON.parse(raw || '{}')
const command = input.tool_input?.command ?? ''
if (!/\bgit\b/.test(command)) process.exit(0)

const PROTECTED = new Set(['main', 'master'])
const mutating = /\bgit\b(?:\s+-[^\s]+(?:\s+[^\s-][^\s]*)?)*\s+(commit|merge|rebase|push)\b/
if (!mutating.test(command)) process.exit(0)

let branch = ''
try {
  branch = execFileSync('git', ['branch', '--show-current'], {
    cwd: input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
    encoding: 'utf8',
  }).trim()
} catch {
  process.exit(0) // not a git repo; nothing to guard
}

const switchesToProtected = /\bgit\s+(checkout|switch)\s+(main|master)\b/.test(command)

if (PROTECTED.has(branch) || switchesToProtected) {
  const target = PROTECTED.has(branch) ? branch : 'main'
  console.error(
    `Blocked: "${command}" would commit/merge/rebase/push on ${target}. ` +
      'Switch to a feature branch first (git switch -c feature/<name>).',
  )
  process.exit(2)
}
