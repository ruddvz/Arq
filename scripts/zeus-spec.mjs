#!/usr/bin/env node
// Zeus 5 spec compiler: turn a request into a specification precise enough to
// implement, and name every question it cannot answer.
//
// The gap it closes. Zeus classified a request and produced a contract, and the
// contract is a routing decision, not a specification: it says which modules and
// which checks, never what "done" looks like for THIS request. So the precision
// of the work still depended on how precisely the request happened to be typed.
//
// What it does NOT do, and this is the honest half: it does not invent intent.
// Everything it fills in is derived from disk - the routed modules' own domain
// requirements, the acceptance criteria the contract computes, the owning role
// from the registry, the checks the impact map selects. Everything it cannot
// derive is emitted as a TODO, and `--check` fails while any TODO remains.
//
// That pairing matters. A skeleton with the right headings would satisfy
// scripts/zeus-visual-contract-lint.mjs while saying nothing, which is a
// generator defeating the checker it was built to feed. The lint proves the
// dimensions are present; `--check` proves they were answered.
//
// Run: node scripts/zeus.mjs spec --task "..." [--out path]
//      node scripts/zeus.mjs spec --check <path>

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compile, manifest, roleRegistry } from './lib/zeus-engine.mjs';

const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));

/** The marker that makes an unanswered question fail a check rather than pass one. */
export const TODO = 'TODO';

/**
 * Domain questions a module cannot be implemented without. Deliberately a short
 * pinned list per module rather than a parse of the module prose: these are the
 * questions whose absence has actually produced rework, and a regex over prose
 * would emit noise that trains people to ignore the section.
 */
const MODULE_QUESTIONS = {
  arqfs: [
    'which schema version this reads and writes, and what an older Arq does with the result',
    'the migration path, and how the original is preserved until the new file is proven',
    'how a half-written file is detected and recovered',
  ],
  geometry: [
    'the canonical unit and tolerance this works in, and where it is resolved',
    'the degenerate and adversarial inputs (zero length, coincident, self-intersecting)',
  ],
  security: [
    'the trust boundary this crosses, and what is untrusted on the far side',
    'what is authorised server-side rather than in the client',
  ],
  ai: [
    'the typed operation produced, its validation, its diff and its undo',
    'what happens when the model proposes something invalid',
  ],
  'ui-visual': ['the canonical tokens used, and which existing component is reused'],
  accessibility: ['the keyboard path, the focus order, and the screen reader announcement'],
  'editor-input': ['the tool lifecycle: preview, commit, cancel, and what undo restores'],
  rendering: ['the frame budget this must hold, and how it is measured'],
  interoperability: ['the unit mapping and what provenance is preserved'],
  'release-production': ['the rollback, and how a bad release is detected before users find it'],
  'github-cicd': ['which checks must be green, and what happens when one is red'],
  incident: ['the stabilisation step, and what evidence proves the incident is closed'],
  architecture: ['which package owns this, and which existing system was checked first'],
};

/**
 * The dimensions scripts/zeus-visual-contract-lint.mjs requires of a UI spec.
 * Emitted as questions, so a generated spec cannot satisfy that lint by shape
 * alone. Kept in the same order the lint lists them, so a reader can match them.
 */
const VISUAL_DIMENSIONS = [
  ['Role and primary task', 'who this is for and the one task they came to do'],
  [
    'Data and content fixture',
    'the fixture or content source, including the longest realistic case',
  ],
  ['Responsive matrix', 'desktop, tablet and phone behaviour, and what reflows'],
  ['State matrix', 'loading, empty, error, permission, offline and partial-success'],
  ['Keyboard and focus', 'tab order, focus visibility and what Escape does'],
  ['Touch and Pencil targets', 'target sizes, 44px minimum, and any Pencil path'],
  ['Tokens and canonical assets', 'which design tokens and existing assets are used'],
  ['Overflow and long content', 'wrapping, truncation and the longest string'],
  ['DPR, zoom and font environment', 'device pixel ratio, 200% zoom and font loading'],
  ['Visual regression', 'the screenshot baseline and diff that proves it'],
  ['Accessibility', 'contrast, non-colour status and the screen reader path'],
  ['Acceptance criteria', 'what makes this done'],
];

const VISUAL_MODULES = new Set(['ui-visual', 'accessibility', 'editor-input']);

const modulePath = (id) => manifest.modules.find((m) => m.id === id)?.path;

/** The module's own requirement prose, so the spec carries the doctrine it must satisfy. */
function moduleRequirements(id, root = packageRoot) {
  const rel = modulePath(id);
  if (!rel) return null;
  try {
    return readFileSync(join(root, rel), 'utf8')
      .split('\n')
      .filter((line) => line.trim() && !line.startsWith('#'))
      .join('\n')
      .trim();
  } catch {
    return null;
  }
}

/**
 * Everything the request leaves open. Each becomes a TODO, and `--check`
 * refuses the spec while one remains.
 */
export function unknowns(contract) {
  const out = [];
  const i = contract.interpretation;
  if (i?.assumptions?.some((a) => a.includes('no delivery stop was stated'))) {
    out.push(`confirm delivery stops at \`${contract.deliveryStop}\`, or say where it should stop`);
  }
  if (!contract.modules.length) {
    out.push(
      'name the files or packages this touches: no domain module matched the wording, so no domain requirements were loaded',
    );
  }
  for (const id of contract.modules) {
    for (const question of MODULE_QUESTIONS[id] ?? []) out.push(`${id}: ${question}`);
  }
  if (contract.risk === 'high' || contract.risk === 'critical') {
    out.push('state the rollback: what undoes this if it is wrong after it lands');
  }
  if (contract.reversibility !== 'reversible') {
    out.push(
      `state the compensating action: this is ${contract.reversibility}, so a revert alone does not restore the previous state`,
    );
  }
  return out;
}

export function buildSpec(task, { contract = compile(task) } = {}) {
  const i = contract.interpretation;
  const visual = contract.modules.some((m) => VISUAL_MODULES.has(m));
  const lines = [];
  const push = (...xs) => lines.push(...xs);

  push(`# Spec: ${i?.words ?? task.trim()}`, '');
  push(
    'Generated by `node scripts/zeus.mjs spec`. Everything below is derived from this',
    'repository. Every `' + TODO + '` is a question Zeus cannot answer for you, and',
    '`zeus spec --check` refuses this file while one remains.',
    '',
  );

  push('## 1. What was asked', '', `> ${i?.words ?? task.trim()}`, '');
  if (i) {
    push(`**Zeus reads this as** ${i.as}.`, `**Not as** ${i.not}.`, '');
    if (i.assumptions.length) push(`**Assumed:** ${i.assumptions.join('; ')}.`, '');
  }

  push('## 2. Classification', '');
  push('| Axis | Value |', '| --- | --- |');
  push(`| Mode | ${contract.mode} |`);
  push(`| Risk | ${contract.risk} |`);
  push(`| Tier | ${contract.tier} |`);
  push(`| Blast radius | ${contract.blastRadius} |`);
  push(`| Reversibility | ${contract.reversibility} |`);
  push(`| Delivery stop | ${contract.deliveryStop} |`, '');

  push('## 3. Who owns it', '');
  push(`- **Accountable role:** ${contract.owner}`);
  if (contract.reviewers.length) push(`- **Review roles:** ${contract.reviewers.join(', ')}`);
  if (contract.reviewAgents.length) {
    push(`- **Reviewer agents:** ${contract.reviewAgents.join(', ')}`);
  }
  push(
    '- Run `node scripts/zeus.mjs gate reviewers` once files change: the reviewer a diff',
    '  requires comes from the changed paths, not from the wording.',
    '',
  );

  push('## 4. Domain requirements', '');
  if (!contract.modules.length) {
    push('No module matched. Only `.zeus/INVARIANTS.md` and the kernel apply.', '');
  }
  for (const id of contract.modules) {
    const body = moduleRequirements(id);
    push(
      `### ${id}`,
      '',
      body ?? `(module file ${modulePath(id) ?? 'missing'} could not be read)`,
      '',
    );
  }

  push('## 5. Acceptance criteria', '');
  for (const a of contract.acceptance) push(`- [ ] ${a}`);
  push('');

  push('## 6. Checks to run', '');
  for (const c of contract.checks) push(`- ${c}`);
  push('');

  const open = unknowns(contract);
  push('## 7. Open questions', '');
  if (!open.length) {
    push('None derived. That is not the same as none existing: read the diff before agreeing.', '');
  }
  for (const q of open) push(`- ${TODO}: ${q}`);
  push('');

  if (visual) {
    push('## 8. Visual and interaction contract', '');
    push(
      'The dimensions `node scripts/zeus.mjs visual-contract` requires. Answer each in',
      'place; the headings alone satisfy that lint without saying anything.',
      '',
    );
    for (const [name, prompt] of VISUAL_DIMENSIONS) {
      push(`### ${name}`, '', `${TODO}: ${prompt}`, '');
    }
  }

  push(`## ${visual ? 9 : 8}. Plan items`, '');
  push(
    'Feed these to the plan ledger, which refuses to close while one is unproven:',
    '',
    '```bash',
  );
  push(`pnpm zeus:plan open --task "${(i?.words ?? task).replace(/"/g, "'")}"`);
  push(
    `pnpm zeus:plan add --title "${TODO}: first item" --owner ${contract.owner} --acceptance "${TODO}: how anyone can tell it is done"`,
  );
  push('```', '');

  return `${lines.join('\n').replace(/\n{3,}/g, '\n\n')}\n`;
}

/** Fails while any question is unanswered. */
export function checkSpec(text) {
  const problems = [];
  const marker = new RegExp(`^\\s*(?:-\\s*)?(?:###\\s*)?${TODO}\\b.*$`, 'gm');
  const open = text.match(marker) ?? [];
  for (const line of open) problems.push(`unanswered: ${line.trim().slice(0, 110)}`);
  if (!/^#\s+Spec:/m.test(text))
    problems.push('this does not look like a Zeus spec (no "# Spec:" heading)');
  return { ready: problems.length === 0, problems };
}

/* --------------------------------- CLI ---------------------------------- */

const USAGE = `Zeus spec compiler - a request turned into something precise enough to implement.

Usage:
  node scripts/zeus.mjs spec --task "..." [--out .zeus/specs/thing.md]
  node scripts/zeus.mjs spec --check <path>

It fills in what this repository already knows: the routed modules' own domain
requirements, the acceptance criteria, the owning role, the checks. It writes a
${TODO} for every question it cannot answer, and --check refuses the file while
one remains. It never invents intent.

For UI work it emits the dimensions zeus visual-contract requires, as questions,
so a generated skeleton cannot satisfy that lint by shape alone.`;

export function main(argv) {
  const val = (n) => {
    const i = argv.indexOf(`--${n}`);
    return i >= 0 ? argv[i + 1] : null;
  };
  if (!argv.length || argv.includes('--help')) {
    console.error(USAGE);
    return argv.length ? 0 : 1;
  }

  const checkPath = val('check');
  if (checkPath) {
    if (!existsSync(checkPath)) throw new Error(`no such spec: ${checkPath}`);
    const { ready, problems } = checkSpec(readFileSync(checkPath, 'utf8'));
    if (ready) {
      console.log(`${checkPath}: every question is answered.`);
      return 0;
    }
    console.error(`${checkPath} is not ready to implement:`);
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }

  const task = val('task');
  if (!task) {
    console.error(USAGE);
    return 2;
  }
  const spec = buildSpec(task);
  const out = val('out');
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, spec, 'utf8');
    console.log(`wrote ${out}`);
    const { problems } = checkSpec(spec);
    if (problems.length)
      console.log(`${problems.length} question(s) to answer before implementing.`);
    return 0;
  }
  process.stdout.write(spec);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(2);
  }
}
