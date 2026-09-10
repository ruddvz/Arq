#!/usr/bin/env node
// Zeus 5 drift guards: the always-on core stays wired, complete and honest.
//
// Zeus already had progressive disclosure. `CLAUDE.md` says to load
// `.zeus/FAST-KERNEL.md` first and not to load the rest of `.zeus/` by default,
// and the modules are routed per tier under explicit context budgets. What it
// did not have is the check that makes a split doctrine safe.
//
// The real danger of splitting doctrine into an always-on core and an on-demand
// specification is not size. It is silent drift: two documents, one quietly
// stale or contradicting the other, with no signal. These guards make the split
// falsifiable.
//
// Two rules govern how they are written, and both were paid for:
//   - Match the INVOCATION, not a filename. A guard that matches a bystander
//     string stays green while the thing it checks is broken.
//   - Derive from disk for any set that grows (commands, modules, blast radius
//     levels, evidence states). A pinned list silently stops covering the next
//     thing added, which is the failure it was written to prevent.
//
// Run: pnpm zeus:drift

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { compile, markdown } from './lib/zeus-engine.mjs';
import { validateAutonomyFiles } from './zeus-autonomy-verify.mjs';

const ROOT = process.cwd();
const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));

const KERNEL = '.zeus/FAST-KERNEL.md';
const HOOK = 'scripts/zeus-hook.sh';
const COMMAND_DIR = '.claude/commands';
const COMMAND_PREFIX = 'zeus-';
/** The harness must still be RUN by the hook, not merely mentioned in it. */
const HARNESS_INVOCATION = /zeus-harness-state\.mjs"?\s+format\b/;
/** Doctrine the kernel is the compression of: everything Zeus would otherwise read. */
const DOCTRINE_DIRS = ['.zeus', '.zeus/modules'];

const errors = [];
const read = (rel) => (existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : '');
const readJson = (rel) => {
  try {
    return JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
  } catch (error) {
    errors.push(`${rel}: ${error.message}`);
    return null;
  }
};

const kernel = read(KERNEL);
const hook = read(HOOK);

/* ------------------------------------------------------------------ guard 1 */
// The harness stays wired to the turn.
//
// Deleting the call, or the script, silently stops learned state reaching the
// model. That is not hypothetical here: before this work, `.zeus/eval-log.jsonl`
// was written by one script and read by nothing, and nobody noticed, which is
// the whole reason the harness exists.
{
  if (!hook) errors.push(`hook not found at ${HOOK}`);
  else if (!HARNESS_INVOCATION.test(hook)) {
    errors.push(
      `${HOOK} no longer runs the harness format command, so learned state would stop reaching the model`,
    );
  }
  if (!existsSync(join(ROOT, 'scripts', 'zeus-harness-state.mjs'))) {
    errors.push('scripts/zeus-harness-state.mjs is missing, so the hook call cannot succeed');
  }
}

/* ------------------------------------------------------------------ guard 2 */
// Every command that carries its own procedure is skipped by the hook.
//
// Driven off the commands ON DISK, never a pinned list: a pinned list stops
// covering the next command someone adds.
{
  const dir = join(ROOT, COMMAND_DIR);
  if (existsSync(dir) && hook) {
    for (const file of readdirSync(dir)) {
      const m = new RegExp(`^(${COMMAND_PREFIX}[a-z-]+)\\.md$`).exec(file);
      if (!m) continue;
      if (!hook.includes(`/${m[1]}`)) {
        errors.push(`${HOOK} does not skip /${m[1]}: add it to the command-skip case`);
      }
    }
  }
}

/* ------------------------------------------------------------------ guard 3 */
// The kernel is provably a SUBSET of the doctrine it compresses.
//
// Each vocabulary below is read off disk, so adding a blast radius level, an
// evidence state or a mode without teaching the always-on file about it fails
// here rather than silently narrowing what every turn can classify.
{
  if (!kernel) errors.push(`cannot read ${KERNEL}`);
  else {
    const config = readJson('.zeus/config.json');
    const blast = readJson('.zeus/blast-radius.json');
    const registry = readJson('.zeus/method-registry.json');

    const vocabularies = [
      ['blast radius level', (blast?.levels ?? []).map((l) => l.id)],
      ['reversibility', (blast?.reversibility ?? []).map((r) => r.id)],
      ['evidence state', config?.evidenceStates ?? []],
      ['mode', Object.keys(registry?.modeDefaults ?? {})],
      ['tier', Object.keys(config?.budgets ?? {})],
    ];
    for (const [label, values] of vocabularies) {
      for (const value of values) {
        if (
          !new RegExp(`\\b${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(kernel)
        ) {
          errors.push(
            `${KERNEL} never names the ${label} "${value}", so a turn cannot classify it`,
          );
        }
      }
    }

    // The tier budgets the kernel publishes must be the ones the compiler
    // enforces. One source of truth, checked rather than trusted.
    for (const [tier, budget] of Object.entries(config?.budgets ?? {})) {
      const heading = new RegExp(
        `\\*\\*${tier}[^*]*\\*\\*:?([^\n]*(?:\n(?!- \\*\\*)[^\n]*)*)`,
        'i',
      );
      const section = heading.exec(kernel)?.[1] ?? '';
      for (const key of ['modules', 'sources', 'supportingMethods']) {
        if (!new RegExp(`\\b${budget[key]}\\b`).test(section)) {
          errors.push(
            `${KERNEL} does not show the configured ${tier}-tier ${key} budget of ${budget[key]}`,
          );
        }
      }
    }

    // Safety statements the always-on read must not lose in compression. This
    // list is deliberately pinned and deliberately short: it is an editorial
    // choice about what a turn cannot start without, not a set that grows. The
    // full register is .zeus/INVARIANTS.md, which the kernel points at.
    const SAFETY = [
      ['canonical-source rule', /outrank old packs|wins on any conflict|is canonical/i],
      ['reuse before building', /search for an existing system/i],
      [
        'invalid operations leave state unchanged',
        /invalid operations leave committed state unchanged/i,
      ],
      ['unknown and blocked are not green', /not Green/i],
      ['no merge or deploy without authority', /without authority and current-head evidence/i],
      ['engineering gate is the merge authority', /merge authority/i],
      ['the invariant register has one home', /INVARIANTS\.md/],
      // The two visibility rules. Without them Zeus can classify a request
      // correctly and still work from a reading the operator never saw, and can
      // dispatch a subagent with a prompt nobody read.
      // `\s+` between every word: this file wraps at 90 columns, so a literal
      // space skips in silence the moment a sentence is reflowed. That is the
      // drift these guards exist to catch, and it has now caught it twice.
      ['show the reading before the work', /show\s+the\s+reading\s+before\s+the\s+work/i],
      [
        'never rewrite the request and act on that',
        /never\s+rewrites?\s+it\s+into\s+different\s+words/i,
      ],
      ['show every delegated prompt in full', /show\s+every\s+delegated\s+prompt\s+in\s+full/i],
      // The loop. Without this line in the always-on read, the plan ledger is a
      // command nobody is told to run, which is how the seven orphans happened.
      // Anchored on the sentence, not on the word `close`, which the kernel
      // writes inside backticks: `close\s+refuses` cannot match "`close` refuses".
      ['close refuses while an item is unfinished', /refuses\s+while\s+any\s+item\s+is\s+pending/i],
      // The spec compiler's one load-bearing promise. A generator that invented
      // intent would be worse than no generator, because its output reads as
      // derived fact.
      ['the spec compiler never invents intent', /never\s+invents?\s+intent/i],
    ];
    for (const [label, pattern] of SAFETY) {
      if (!pattern.test(kernel)) errors.push(`${KERNEL} no longer states: ${label}`);
    }

    /* ---------------------------------------------------------------- guard 4 */
    // The PUBLISHED saving must stay true.
    //
    // A precise integer that has to be hand-synced is the wrong thing to
    // publish: exact equality sits one edit away from a rounding boundary and
    // makes an unrelated documentation change fail this check. Claim a FLOOR,
    // guard the floor, and guard the floor against decaying into meaninglessness.
    let doctrineBytes = 0;
    for (const rel of DOCTRINE_DIRS) {
      const dir = join(ROOT, rel);
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir)) {
        if (file.endsWith('.md')) doctrineBytes += readFileSync(join(dir, file), 'utf8').length;
      }
    }
    if (doctrineBytes <= kernel.length) {
      errors.push('the doctrine set is not larger than the kernel, so the split buys nothing');
    } else {
      const actual = 100 - (kernel.length / doctrineBytes) * 100;
      const stated = kernel.match(/over (\d+)% smaller than the full/);
      if (!stated) {
        errors.push(
          `${KERNEL} no longer states the "over N% smaller than the full ..." saving: a published claim must stay checkable`,
        );
      } else if (actual < Number(stated[1])) {
        errors.push(
          `${KERNEL} claims over ${stated[1]}% smaller; actual ${actual.toFixed(1)}% - the split has stopped paying for itself`,
        );
      } else if (actual - Number(stated[1]) > 10) {
        errors.push(
          `${KERNEL} claims over ${stated[1]}% smaller but actual is ${actual.toFixed(1)}% - the floor has drifted too far below the truth to mean anything; raise it`,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ guard 5 */
// The core is read INSTEAD of the full specification, never in addition.
//
// The reference implementation shipped "open the full spec when risk is high",
// which meant a high-risk turn read the core AND the spec and cost more than
// before the split, on exactly the expensive turns. The word "instead" is
// load-bearing, so something has to hold it in place.
{
  const claude = read('CLAUDE.md');
  if (!claude) errors.push('CLAUDE.md not found, so the read-instead-of rule is unstated');
  // `\s+`, not a literal space: CLAUDE.md wraps this sentence across a newline,
  // and a guard that only matches one line spacing skips in silence, which is
  // the drift it exists to catch.
  else if (!/not\s+load\s+the\s+rest\s+of\s+`?\.zeus\/`?\s+by\s+default/i.test(claude)) {
    errors.push(
      'CLAUDE.md no longer says the rest of .zeus/ is not loaded by default: without it the core is read in ADDITION to the specification and the split costs more than it saves',
    );
  }
}

/* ------------------------------------------------------------------ guard 5b */
// Every Zeus script is reachable by something.
//
// Measured before this guard existed: 7 of 39 scripts could be run by nothing at
// all. Not the CLI, not a package script, not the hook, not CI, not a document.
// Among them was zeus-run-state.mjs, which carries the entire delivery pipeline
// Zeus documents in .zeus/TASK-STATE-MACHINE.md, and zeus-role-plan.mjs, which
// assigns the owning role for a task. Dead code in an operating system is worse
// than dead code in a feature: it reads as capability the system does not have.
//
// Reachability is transitive, because a library is legitimately reached only by
// its importers.
{
  const scriptDir = join(ROOT, 'scripts');
  if (existsSync(scriptDir)) {
    const scripts = readdirSync(scriptDir).filter((f) => /^zeus-.*\.(mjs|sh)$/.test(f));
    const bodies = Object.fromEntries(scripts.map((f) => [f, read(`scripts/${f}`)]));
    const entryText = [
      read('scripts/zeus.mjs'),
      read('package.json'),
      read('scripts/zeus-hook.sh'),
      read('scripts/test-zeus-system.sh'),
      ...(existsSync(join(ROOT, '.github/workflows'))
        ? readdirSync(join(ROOT, '.github/workflows')).map((f) => read(`.github/workflows/${f}`))
        : []),
    ].join('\n');

    const reachable = new Set(scripts.filter((f) => entryText.includes(f)));
    for (let changed = true; changed; ) {
      changed = false;
      for (const f of scripts) {
        if (reachable.has(f)) continue;
        if (
          scripts.some((other) => other !== f && reachable.has(other) && bodies[other].includes(f))
        ) {
          reachable.add(f);
          changed = true;
        }
      }
    }
    for (const f of scripts) {
      if (!reachable.has(f)) {
        errors.push(
          `scripts/${f} can be run by nothing: no CLI verb in scripts/zeus.mjs, no package script, no hook, no CI step, and no other Zeus script imports it`,
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ guard 6 */
// The compiled contract still SHOWS its reading, and shows it first.
//
// Behavioural, not textual: it compiles a real task and reads the rendered
// output, because a guard that greps the renderer stays green when the field
// stops being populated, and a guard that checks the field stays green when the
// renderer stops printing it. The operator only ever sees the rendered form.
{
  try {
    const contract = compile('Add a door tool to the plan canvas and open a pull request');
    const i = contract.interpretation;
    if (!i || !i.as || !i.not || !Array.isArray(i.assumptions) || !i.words) {
      errors.push('the compiled contract carries no usable interpretation of the request');
    }
    const rendered = markdown(contract);
    const readingAt = rendered.indexOf('Zeus reads this as');
    const classificationAt = rendered.indexOf('Mode / risk / tier / stop');
    if (readingAt === -1) {
      errors.push('the rendered contract no longer shows how Zeus read the request');
    } else if (classificationAt !== -1 && readingAt > classificationAt) {
      errors.push(
        'the rendered contract shows its classification before its reading; the reading is the line that catches a misread and must come first',
      );
    }
    if (!rendered.includes(i?.words ?? '\u0000')) {
      errors.push('the rendered contract no longer quotes the operator back to themselves');
    }
  } catch (error) {
    errors.push(`cannot compile a contract to check the reading: ${error.message}`);
  }
}

/* ------------------------------------------------------------------ guard 7 */
// The gate ledger's configuration still points at things that exist.
{
  const config = readJson('.zeus/config.json');
  const pkg = readJson('package.json');
  for (const gate of config?.gates?.repositoryGates ?? []) {
    if (!pkg?.scripts?.[gate]) {
      errors.push(
        `.zeus/config.json gates.repositoryGates names "${gate}", which is not a package script`,
      );
    }
  }
  for (const script of ['zeus:harness', 'zeus:gate', 'zeus:drift', 'zeus:plan']) {
    if (!pkg?.scripts?.[script]) errors.push(`package.json has no "${script}" script`);
  }
}

// Project-local autonomy is part of canonical drift state. A weakened autonomy
// contract must fail the normal `zeus:drift` command, not only a focused helper.
errors.push(...validateAutonomyFiles(ROOT));

if (packageRoot !== ROOT) {
  console.error(`drift guards must run from the repository root (got ${ROOT})`);
  process.exit(2);
}
if (errors.length) {
  console.error('Zeus drift guards failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log(`Zeus drift guards passed (${KERNEL} is wired, complete and honestly measured).`);
