#!/usr/bin/env node
// Zeus 5: the single source of truth for "which agents can Claude Code dispatch".
//
// Ported in spirit from PrimeIntellect-ai/prime-agent (MIT, inspected at f8f0222)
// by way of the reference integration, whose review round 3 caught this exact
// module having been half-migrated: its header claimed it had replaced two
// definitions of "dispatchable" while one caller still carried its own, so the
// commit added a third. Two definitions behind one guard disagree on the next
// edit, which is the drift `.zeus/INVARIANTS.md` tells us to search for before
// building a second system.
//
// Both callers in this repository use this module and nothing else:
//   - scripts/zeus-validate.mjs   (module reviewer existence, agent frontmatter)
//   - scripts/zeus-gate-ledger.mjs (the review gate)
//
// An agent is dispatchable only if its leading `---` frontmatter block carries a
// non-empty `description:`. Claude Code never registers one without it, so an
// agent name that fails this check names something nothing could ever have run.
//
// Precisely: the rule is "any `.md` in this directory whose leading `---` block
// carries a non-empty `description:`". That is broader than "is a reviewer" - a
// README with ordinary frontmatter would count. It is stated rather than
// tightened because adding a file to `.claude/agents/` is diff-visible and moves
// the workspace fingerprint, which invalidates every recorded gate anyway.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Frontmatter only: the block between the opening and the closing `---`. */
function frontmatter(text) {
  if (!text.startsWith('---')) return '';
  const end = text.indexOf('\n---', 3);
  return end === -1 ? '' : text.slice(3, end);
}

/**
 * @param {string} [dir] defaults to `<cwd>/.claude/agents`
 * @returns {{dispatchable: Set<string>, roleDocs: string[], exists: boolean}}
 */
export function agentRegistry(dir = join(process.cwd(), '.claude', 'agents')) {
  const dispatchable = new Set();
  const roleDocs = [];
  if (!existsSync(dir)) return { dispatchable, roleDocs, exists: false };
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith('.md')) continue;
    const name = file.replace(/\.md$/, '');
    if (/^description:\s*\S/m.test(frontmatter(readFileSync(join(dir, file), 'utf8')))) {
      dispatchable.add(name);
    } else {
      roleDocs.push(name);
    }
  }
  return { dispatchable, roleDocs, exists: true };
}
