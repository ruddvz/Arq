#!/usr/bin/env node
// ZEUS Operator OS 2.0 stop evidence check, adapted for the Arq repository.
//
// Adaptations against the packaged version: the Stop hook payload carries only
// session metadata, so matching completion language against the payload never
// fires. This version reads the real transcript and blocks only the precise
// case it is meant to catch, a completion claim in a session that produced no
// tool evidence at all. The strict high-risk change gate stays opt-in through
// ZEUS_STRICT_CHANGE_GATES=1.
const fs = require('node:fs');
const cp = require('node:child_process');

const COMPLETION_CLAIM =
  /\b(?:tests?|build|typecheck|lint|benchmark|migration|deployment|deploy|commit|push|pull request|PR|release|CI)\b[^.\n]{0,60}\b(?:passed|passes|succeeded|completed|deployed|created|pushed|merged|is green|are green)\b/i;

const HIGH_RISK_PATHS =
  /\b(?:migrations?|schema|file[-_]?format|persistence|storage|recovery|geometry|kernel|sync|conflict|permissions?|auth|ai[-_]?apply|arqfs|project-format)\b/i;
const TEST_PATHS = /\b(?:test|tests|spec|specs|fixture|fixtures|benchmark|benchmarks)\b/i;

function block(message) {
  console.error(message);
  process.exit(2);
}

function readTranscript(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return null;
  let raw = '';
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return null;
  }
  const assistantText = [];
  let sawToolUse = false;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const content = entry?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part?.type === 'tool_use' || part?.type === 'tool_result') sawToolUse = true;
      if (part?.type === 'text' && entry?.message?.role === 'assistant') assistantText.push(String(part.text || ''));
    }
  }
  return { assistantText: assistantText.join('\n'), sawToolUse };
}

let input = '';
process.stdin.on('data', (d) => {
  input += d;
});
process.stdin.on('end', () => {
  let payload = {};
  try {
    payload = JSON.parse(input || '{}');
  } catch {
    process.exit(0);
  }

  if (payload.stop_hook_active) process.exit(0);

  const transcript = readTranscript(payload.transcript_path);
  if (transcript && !transcript.sawToolUse && COMPLETION_CLAIM.test(transcript.assistantText)) {
    block('ZEUS quality gate: a completion claim was made without running any command or inspecting the repository. Run the check or state the status as Not inspected.');
  }

  if (process.env.ZEUS_STRICT_CHANGE_GATES === '1') {
    let files = '';
    try {
      files = cp.execSync('git diff --name-only --cached; git diff --name-only', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      files = '';
    }
    if (HIGH_RISK_PATHS.test(files) && !TEST_PATHS.test(files)) {
      block('ZEUS strict gate: high-risk paths changed without an accompanying test, fixture or benchmark change.');
    }
  }

  process.exit(0);
});
