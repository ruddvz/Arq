#!/usr/bin/env node
/**
 * Renders docs/product/IMPLEMENTATION-PACK-3.0-REGISTER.md from its machine
 * source. The register records what this repository can actually support for
 * each of the 205 tasks the ARQ CAD System Implementation Pack 3.0 proposes, so
 * the prose and the data cannot drift: edit the JSON and re-run this.
 *
 * Usage: node scripts/build-implementation-pack-register.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(repoRoot, 'docs/product/implementation-pack-3.0-register.json');
const outputPath = path.join(repoRoot, 'docs/product/IMPLEMENTATION-PACK-3.0-REGISTER.md');
const reg = JSON.parse(readFileSync(sourcePath, 'utf8'));

const meaning = {
  verified: 'Behaves as described and current evidence in this repository shows it.',
  implemented: 'The code exists and is tested; no current run was made for this claim.',
  'partially-verified': 'Part of the item is real and part is not. The note says which.',
  proposed: 'Not implemented here. The pack proposes it; nothing in the repository does it yet.',
  blocked:
    'Cannot be closed by changing code. It needs an owner decision or a setting outside the repository.',
  'not-inspected':
    'This pass did not open the relevant code. A fact about this review, not about the repository.',
};

let out = `# Implementation Pack 3.0: what is real, per item

_Generated from \`docs/product/implementation-pack-3.0-register.json\`; regenerate that file rather than editing this one by hand._

The ARQ CAD System Implementation Pack 3.0 proposes 205 tasks across fifteen
phases. A pack is evidence and a proposed handoff, not repository authority -
so every item below carries the state this repository can actually support for
it, in the pack's own vocabulary, with the evidence that decided it.

The pack was written against revision \`62c5e5c\` and observed a default branch
and a set of open pull requests that have since moved. This register is
reconciled against ${reg.reconciledAgainst}, not against what the pack saw.

## What the states mean

`;
for (const [state, text] of Object.entries(meaning)) {
  out += `- **${state}** (${reg.counts[state] ?? 0}) - ${text}\n`;
}

out += `
Only \`verified\` is green. \`blocked\` is not a failure and \`not-inspected\` is
not a pass: both are the honest answer to a question this review could not
close, and the pack's own rule is that Unknown, Blocked and Failed are not
Green.

## The largest remaining gaps

1. **Publication (P5, \`V3-063\` to \`V3-074\`).** Opening works; saving writes
   into the working copy. Nothing checkpoints a clean portable \`.arq\`, reopens
   it with a fresh reader and compares project id, revision and semantic hash.
   Until that exists no surface may say a project was published.
2. **Units, tolerances and stable references (P8).** No canonical
   integer-micrometre length type, no tolerance-class registry, no semantic
   role references and no constraint solver. The pack makes the solver depend
   on accepted unit and tolerance ADRs; neither is accepted.
3. **Owner-blocked release authority (P14).** The default-branch migration,
   repository visibility and licence, required reviewers, the Vercel automation
   bypass and the release certificate are all settings and decisions outside
   this repository. \`verify-routes\` fails today for exactly one of these: with
   no \`VERCEL_AUTOMATION_BYPASS_SECRET\` the preview origin returns a sign-in
   page, so routing is Not inspected rather than wrong.
4. **Reachability, not absence.** Several libraries are complete and tested with
   no product consumer - \`packages/project-loading\`, \`packages/derived-cache\`,
   the sheet and PDF stack, and the MCP boundary. The pack counts a library
   without a caller as unfinished, and so does this register.

## Register

`;

let phase = '';
for (const task of reg.tasks) {
  if (task.phase !== phase) {
    phase = task.phase;
    out += `\n### ${task.phase} - ${task.phaseName}\n\n| Item | Task | State | Evidence |\n|---|---|---|---|\n`;
  }
  const esc = (s) => s.replace(/\|/g, '\\|');
  out += `| \`${task.id}\` | ${esc(task.task)} | ${task.state} | ${esc(task.evidence)} |\n`;
}

// Formatted through the repository's own Prettier rather than emitted raw, so
// `pnpm build:pack-register` followed by `pnpm format:check` cannot disagree.
const prettier = await import('prettier');
const formatted = await prettier.format(out, {
  ...(await prettier.resolveConfig(outputPath)),
  filepath: outputPath,
});
writeFileSync(outputPath, formatted);
console.log(`Wrote ${path.relative(repoRoot, outputPath)} (${reg.taskCount} tasks).`);
