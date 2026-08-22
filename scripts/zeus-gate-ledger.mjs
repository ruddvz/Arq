#!/usr/bin/env node
// Zeus 5 gate ledger: loop bounds and gate results recorded rather than claimed.
//
// `.zeus/FAST-KERNEL.md` states a repair budget per tier and a verification
// ladder, then trusts the model to honour both. `scripts/zeus-evidence.mjs`
// records what each CLAIM rests on, which is the other half, but nothing
// recorded which GATE had actually run, at which round, or against which
// version of the working tree. "Verified" was therefore a memory, which is the
// exact failure `.zeus/EVIDENCE-STATES.md` exists to prevent.
//
// Ported in spirit from prime-agent's autonomous-mode quality gates (MIT,
// inspected at f8f0222), which bound continuations in the host and refuse to
// rerun a gate when the workspace has not changed.
//
// Everything it needs already exists in this repository and is reused rather
// than reinvented, per `.zeus/INVARIANTS.md` (search for an existing system
// before creating another):
//   scripts/zeus-fingerprint.mjs  the workspace signature
//   .zeus/config.json budgets     repairRounds per tier, the loop bound
//   .zeus/config.json gates       the unconditional repository gate set
//   .zeus/blast-radius.json       which radii require independent review
//   scripts/zeus-reviewer-match   which reviewer the changed paths call for
//
// Five rules carry the weight:
//   1. A gate result belongs to the fingerprint it was recorded at. Edit
//      anything and it goes stale, because it no longer describes this tree.
//   2. A FAILED gate is never skippable, even at the same fingerprint. Fix it;
//      do not re-declare it.
//   3. Rounds are bounded by the tier's repairRounds, so the ledger and the
//      kernel cannot drift apart.
//   4. The repository gate set is unconditional. Requiring only that RECORDED
//      gates passed means recording one gate and nothing else is green.
//   5. Independent review is a gate. Where risk or blast radius requires it,
//      ship refuses without a passing review by an agent that exists on disk
//      AND that the changed paths actually call for.
//
// What it does NOT prove, stated plainly: recording `typecheck --outcome pass`
// does not run `tsc`. The ledger records a claim about a check, not the check.
// It converts a silent assumption into an auditable, falsifiable, deliberately
// made statement, which is a real gain and less than enforcement.

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { agentRegistry } from './zeus-agent-registry.mjs';
import { requiredReviewers } from './zeus-reviewer-match.mjs';

const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));

/** Zeus's own risk vocabulary. `moderate`, not the reference system's `medium`. */
const RISKS = ['low', 'moderate', 'high', 'critical'];
const RISK_SET = new Set(RISKS);
const TIERS = new Set(['fast', 'standard', 'deep']);
const OUTCOMES = new Set(['pass', 'fail']);
const REVIEW_PREFIX = 'review:';

/**
 * Spellings that mean the same check. The WHICH lives in .zeus/config.json;
 * this table only normalises how a gate was typed, so config stays the single
 * source of truth for the gate set itself.
 */
const ALIASES = {
  'format:check': ['format:check', 'format', 'prettier'],
  lint: ['lint', 'eslint'],
  typecheck: ['typecheck', 'tsc', 'types', 'tsc --noemit'],
  test: ['test', 'tests', 'vitest', 'suite'],
  build: ['build'],
};

export function gateConfig(root = packageRoot) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(join(root, '.zeus', 'config.json'), 'utf8'));
  } catch (error) {
    throw new Error(`cannot read .zeus/config.json - ${error.message}`);
  }
  const g = raw.gates;
  if (!g || typeof g !== 'object') throw new Error('.zeus/config.json has no "gates" block');
  if (!Array.isArray(g.repositoryGates) || g.repositoryGates.length === 0) {
    throw new Error(
      '.zeus/config.json gates.repositoryGates is empty, so ship could infer nothing',
    );
  }
  if (!Array.isArray(g.reviewRequiredAtRisk) || g.reviewRequiredAtRisk.length === 0) {
    throw new Error('.zeus/config.json gates.reviewRequiredAtRisk is empty');
  }
  for (const r of g.reviewRequiredAtRisk) {
    if (!RISK_SET.has(r)) throw new Error(`gates.reviewRequiredAtRisk names unknown risk "${r}"`);
  }
  if (typeof g.store !== 'string' || !g.store.trim()) {
    throw new Error('.zeus/config.json gates.store is not a path');
  }
  return g;
}

/**
 * Loop bounds come from the tier budgets already in .zeus/config.json, so the
 * ledger and the kernel's repair budget cannot disagree.
 */
export function loopBounds(root = packageRoot) {
  let budgets;
  try {
    budgets = JSON.parse(readFileSync(join(root, '.zeus', 'config.json'), 'utf8')).budgets ?? {};
  } catch (error) {
    throw new Error(`cannot read loop bounds from .zeus/config.json - ${error.message}`);
  }
  const bounds = {};
  for (const tier of TIERS) {
    const n = budgets[tier]?.repairRounds;
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`.zeus/config.json budgets.${tier}.repairRounds is not a positive integer`);
    }
    bounds[tier] = n;
  }
  return bounds;
}

/** Blast radius levels that require independent review, read off disk. */
export function reviewRequiringRadii(root = packageRoot) {
  try {
    const blast = JSON.parse(readFileSync(join(root, '.zeus', 'blast-radius.json'), 'utf8'));
    return new Set((blast.levels ?? []).filter((l) => l.requiresReview).map((l) => l.id));
  } catch {
    // Fail closed: if the radius table cannot be read, every radius is treated
    // as review-requiring rather than none of them.
    return null;
  }
}

export function ledgerPath(root = packageRoot) {
  const override = (process.env.ZEUS_GATE_LEDGER ?? '').trim();
  return override || join(root, gateConfig(root).store);
}

/** The workspace signature, from Zeus's existing fingerprint script. */
export function workspaceSignature(root = process.cwd()) {
  const r = spawnSync(
    process.execPath,
    [join(packageRoot, 'scripts', 'zeus-fingerprint.mjs'), '--root', root],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  );
  if (r.status !== 0) throw new Error(`cannot compute the workspace fingerprint: ${r.stderr}`);
  return JSON.parse(r.stdout).fingerprint;
}

/** Normalises a recorded gate name onto one of the configured slots, or null. */
export function requiredSlot(gate, slots) {
  const g = String(gate).trim().toLowerCase();
  for (const slot of slots) {
    const aliases = ALIASES[slot] ?? [slot];
    if (aliases.includes(g)) return slot;
  }
  return null;
}

const now = () => new Date().toISOString();

export function emptyLedger() {
  return {
    version: 1,
    task: null,
    risk: null,
    tier: null,
    blastRadius: null,
    round: 0,
    bound: null,
    gates: [],
  };
}

export function loadLedger(path = ledgerPath()) {
  if (!existsSync(path)) return emptyLedger();
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return emptyLedger();
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.gates)) throw new Error(`${path}: not a Zeus gate ledger`);
  return parsed;
}

export function saveLedger(ledger, path = ledgerPath()) {
  mkdirSync(dirname(path), { recursive: true });
  // Write-then-rename: an interrupted in-place write leaves a truncated ledger,
  // which loadLedger then rejects as "not a Zeus gate ledger", losing every
  // recorded gate for the task. Rename is atomic on one filesystem.
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
  return ledger;
}

export function startTask(ledger, { task, risk, tier, blastRadius = null, bounds }) {
  if (!task) throw new Error('start requires --task "<name>"');
  if (!RISK_SET.has(risk)) throw new Error(`risk must be one of ${RISKS.join('|')}`);
  if (!TIERS.has(tier)) throw new Error(`tier must be one of ${[...TIERS].join('|')}`);
  return {
    ...emptyLedger(),
    task,
    risk,
    tier,
    blastRadius,
    round: 1,
    bound: bounds[tier],
    startedAt: now(),
  };
}

export function recordGate(ledger, { gate, outcome, evidence, signature }) {
  if (!ledger.task) {
    throw new Error('no task open - run: pnpm zeus:gate start --task "..." --risk <r> --tier <t>');
  }
  if (!gate) throw new Error('record requires --gate <name>');
  if (!OUTCOMES.has(outcome)) throw new Error(`outcome must be ${[...OUTCOMES].join('|')}`);
  // A passing gate with no evidence is exactly the claim-without-a-check this
  // ledger exists to stop.
  if (outcome === 'pass' && !evidence) {
    throw new Error(
      'a passing gate requires --evidence (the command output or result that proves it)',
    );
  }
  const entry = {
    gate,
    outcome,
    evidence: evidence ?? '',
    round: ledger.round,
    signature,
    recordedAt: now(),
  };
  // One row per gate: the latest result replaces the previous one, and history
  // lives in the round number rather than in duplicate rows.
  const gates = ledger.gates.filter((g) => g.gate !== gate);
  gates.push(entry);
  return { ledger: { ...ledger, gates }, entry };
}

/**
 * A gate may be skipped only if it PASSED at the current signature. A failed
 * gate is never skippable, and a stale one describes a tree that no longer
 * exists.
 */
export function canSkip(ledger, gate, signature) {
  const found = ledger.gates.find((g) => g.gate === gate);
  if (!found) return { skippable: false, reason: `${gate} has never run` };
  if (found.outcome !== 'pass') {
    return {
      skippable: false,
      reason: `${gate} did not pass at round ${found.round} (outcome "${found.outcome}") - fix it, do not re-declare it`,
    };
  }
  if (found.signature !== signature) {
    return {
      skippable: false,
      reason: `${gate} passed, but the workspace changed since - the result is stale`,
    };
  }
  return {
    skippable: true,
    reason: `${gate} passed at this exact workspace signature (round ${found.round})`,
  };
}

export function nextRound(ledger, bounds = loopBounds()) {
  if (!ledger.task) throw new Error('no task open');
  const next = ledger.round + 1;
  // A ledger written by hand, or by an older version, can carry bound null.
  // `2 > null` is true, so a naive guard throws an unfixable stop. Treating a
  // null bound as UNBOUNDED is the opposite mistake and drops rule 3 on exactly
  // the ledger that had lost it, so re-derive the bound from the tier instead.
  //
  // TIERS.has, not a truthiness check: `bounds` is a plain object built from
  // JSON and carries Object.prototype, so indexing it with an unvalidated tier
  // string reaches inherited members. `tier: "constructor"` yields a FUNCTION,
  // `next > <function>` is NaN-false so nothing ever bounds, and JSON.stringify
  // then drops the key, leaving the ledger permanently unbounded.
  const bound =
    ledger.bound ??
    (TIERS.has(ledger.tier) ? bounds[ledger.tier] : Math.min(...Object.values(bounds)));
  if (next > bound) {
    throw new Error(
      `round ${next} exceeds the ${TIERS.has(ledger.tier) ? `${ledger.tier}-tier` : 'strictest (unrecognised tier)'} repair budget of ${bound}. ` +
        '.zeus/FAST-KERNEL.md: stop after the tier repair budget and report what is still failing. ' +
        'A bound is not permission to hide a red result.',
    );
  }
  return { ...ledger, round: next, bound };
}

/**
 * Whether this ledger's risk and blast radius require independent review.
 * Mirrors scripts/lib/zeus-engine.mjs: risk at the configured threshold, or a
 * blast radius level whose `requiresReview` flag is set.
 */
export function reviewRequired(
  ledger,
  { config = gateConfig(), radii = reviewRequiringRadii() } = {},
) {
  if (config.reviewRequiredAtRisk.includes(ledger.risk)) return true;
  // A radius table that could not be read means every radius is treated as
  // review-requiring: an unreadable rule must not become a waiver.
  if (radii === null) return true;
  return Boolean(ledger.blastRadius) && radii.has(ledger.blastRadius);
}

/**
 * Ship readiness. Green requires every recorded gate to have passed at the
 * current signature; anything else is partial or blocked, never green.
 *
 * @param {object} ledger
 * @param {string} signature
 * @param {{reviewers?: Set<string>, match?: object, config?: object, radii?: Set<string>|null}} [deps]
 */
export function shipReadiness(ledger, signature, deps = {}) {
  const problems = [];
  if (!ledger.task) return { ready: false, problems: ['no task open - nothing was gated'] };

  const config = deps.config ?? gateConfig();
  const slots = config.repositoryGates;

  if (ledger.gates.length === 0) {
    problems.push('no gate has run - "verified" would be a claim, not a fact');
  }
  for (const g of ledger.gates) {
    // `!== 'pass'`, not `=== 'fail'`. The ledger is a plain JSON file and
    // loadLedger validates only that `gates` is an array, so a hand-edited or
    // foreign-written outcome of "PASS" or "ok" would otherwise satisfy every
    // pass check by failing the fail check: a reject laundered into green.
    if (g.outcome !== 'pass') {
      problems.push(`${g.gate} is not passing (round ${g.round}, outcome "${g.outcome}")`);
    } else if (g.signature !== signature) {
      problems.push(`${g.gate} passed against an older workspace - re-run it`);
    }
  }

  // A named floor, so "green" cannot mean "the one gate I bothered to record".
  const satisfied = new Set(
    ledger.gates
      .filter((g) => g.outcome === 'pass' && g.signature === signature)
      .map((g) => requiredSlot(g.gate, slots))
      .filter(Boolean),
  );
  const missing = slots.filter((slot) => !satisfied.has(slot));
  if (missing.length) {
    problems.push(
      `these gates were never recorded as passing at this workspace: ${missing.join(', ')} - ` +
        '.zeus/config.json gates.repositoryGates is unconditional, so ship cannot infer them',
    );
  }

  if (reviewRequired(ledger, { config, radii: deps.radii ?? reviewRequiringRadii() })) {
    // Only read disk when the caller has not supplied the set: a test that
    // injects reviewers must not silently depend on the real .claude/agents.
    const registry = deps.reviewers ? null : agentRegistry();
    const known = deps.reviewers ?? registry.dispatchable;
    if (registry && !registry.exists) {
      problems.push(
        '.claude/agents/ is unreadable, so no review can be verified - run from the repository root',
      );
    }

    // The match check the reference implementation named as its largest gap.
    // `required` is the reviewer set the CHANGED PATHS call for, via
    // .zeus/impact-map.json and .zeus/module-manifest.json. When it cannot be
    // computed, fall back to "any dispatchable agent" and SAY SO, rather than
    // concluding that no review was needed.
    let match;
    try {
      match = deps.match ?? requiredReviewers({});
    } catch (error) {
      match = {
        required: [],
        matched: false,
        reason: `reviewer match failed: ${error.message}`,
        modules: [],
      };
    }
    const accepted = match.matched ? new Set(match.required) : known;

    const reviews = ledger.gates.filter((g) => g.gate.startsWith(REVIEW_PREFIX));
    const nameOf = (g) => g.gate.slice(REVIEW_PREFIX.length).trim();
    const named = reviews.filter((g) => accepted.has(nameOf(g)));
    const bogus = reviews.filter((g) => !known.has(nameOf(g)));
    const wrongReviewer = reviews.filter((g) => known.has(nameOf(g)) && !accepted.has(nameOf(g)));
    const review =
      named.find((g) => g.outcome === 'pass' && g.signature === signature) ??
      named.find((g) => g.outcome === 'pass') ??
      named[0];

    // Only complain about an unrecognised reviewer when no real review carried
    // the work. Reporting every bogus row unconditionally means one typo'd name
    // bricks the ledger for good: gates dedupe by name so the row cannot be
    // removed, and the only escape is `clear --yes`, which discards the genuine
    // review too.
    if (!review || review.outcome !== 'pass') {
      for (const g of bogus) {
        problems.push(
          `"${g.gate}" names no dispatchable agent - .claude/agents/${nameOf(g)}.md does not exist ` +
            'or has no description: frontmatter, so nothing could have run it',
        );
      }
      for (const g of wrongReviewer) {
        problems.push(
          `"${g.gate}" is a real agent but not one the changed paths call for (${match.reason}); ` +
            `this diff needs: ${match.required.join(', ')}`,
        );
      }
    }
    if (!review) {
      const who = match.matched
        ? `the reviewer the changed paths call for (${match.required.join(', ')})`
        : `a dispatchable reviewer (${match.reason}, so any of: ${[...known].sort().join(', ')})`;
      problems.push(
        `${ledger.risk} risk / ${ledger.blastRadius ?? 'unrecorded'} blast radius requires independent review and none was recorded - dispatch ${who}, then: ` +
          `pnpm zeus:gate record --gate ${REVIEW_PREFIX}<reviewer> --outcome pass --evidence "<what it found>"`,
      );
    } else if (review.outcome === 'pass' && review.signature !== signature) {
      problems.push(
        `${review.gate} reviewed an older workspace - the diff changed since, so re-review it`,
      );
    }
    if (match.unknownReviewers?.length) {
      problems.push(
        `.zeus/module-manifest.json names reviewer(s) that are not dispatchable: ${match.unknownReviewers.join(', ')}`,
      );
    }
  }

  return { ready: problems.length === 0, problems };
}

/* --------------------------------- CLI ---------------------------------- */

function arg(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}

const USAGE = `Zeus gate ledger - loop bounds and gate results, recorded rather than claimed.

Usage:
  pnpm zeus:gate start --task "<name>" --risk <low|moderate|high|critical> --tier <fast|standard|deep> [--blast-radius <id>]
  pnpm zeus:gate record --gate <name> --outcome <pass|fail> --evidence "<proof>"
  pnpm zeus:gate can-skip --gate <name>   exit 0 only if it passed and nothing changed
  pnpm zeus:gate round                    next repair round; refuses past the tier budget
  pnpm zeus:gate ship                     exit 0 only when green (see below)
  pnpm zeus:gate status
  pnpm zeus:gate reviewers                who the current changed paths call for
  pnpm zeus:gate clear --yes              discards every recorded gate

ship is green only when ALL of these hold at the current workspace signature:
  - every recorded gate passed;
  - every gate in .zeus/config.json gates.repositoryGates was recorded passing;
  - where risk or blast radius requires review, a review:<agent> gate passed,
    naming an agent that exists in .claude/agents/ AND that the changed paths
    call for through .zeus/impact-map.json and .zeus/module-manifest.json.

A gate result belongs to the workspace signature it was recorded at: edit
anything and it goes stale. A failed gate is never skippable. Rounds are bounded
by .zeus/config.json budgets.<tier>.repairRounds. Recording a FAILING gate exits
0 - the record succeeded; ship is where a red gate stops the work.

The ledger records a claim about a check, not the check itself.`;

export function main(argv) {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help') {
    console.error(USAGE);
    return command ? 0 : 1;
  }
  const ledger = loadLedger();

  switch (command) {
    case 'start': {
      // Same guard as `clear`, for the same reason. An unguarded `start` resets
      // the ledger with no warning, so a recorded failure can be discarded in
      // one command, and the author also picks the new risk and tier, which is
      // how a deep critical task becomes a fast low one that needs no review.
      // Guarding `clear` and leaving `start` open guards the door and leaves the
      // window.
      if (ledger.gates.length && !args.includes('--yes')) {
        const passed = ledger.gates.filter((g) => g.outcome === 'pass').length;
        console.error(
          `a ledger for "${ledger.task}" (${ledger.risk} risk, ${ledger.tier} tier) already holds ` +
            `${ledger.gates.length} recorded gate(s), ${passed} passing. Starting over discards them, ` +
            'including any recorded review. Re-run with --yes if that is genuinely a new task. ' +
            'Starting over is not a way to pass a gate, and re-declaring a lower tier is not a way to skip review.',
        );
        return 1;
      }
      const next = startTask(ledger, {
        task: arg(args, 'task'),
        risk: arg(args, 'risk'),
        tier: arg(args, 'tier'),
        blastRadius: arg(args, 'blast-radius', null),
        bounds: loopBounds(),
      });
      saveLedger(next);
      console.log(
        `gate ledger open: "${next.task}" (${next.risk} risk, ${next.tier} tier, round 1 of ${next.bound})`,
      );
      return 0;
    }
    case 'record': {
      const { ledger: next, entry } = recordGate(ledger, {
        gate: arg(args, 'gate'),
        outcome: arg(args, 'outcome'),
        evidence: arg(args, 'evidence'),
        signature: workspaceSignature(),
      });
      saveLedger(next);
      console.log(
        `${entry.outcome === 'pass' ? 'PASS' : 'FAIL'} ${entry.gate} (round ${entry.round})`,
      );
      if (entry.outcome === 'fail') {
        console.log(
          'recorded as failing - ship will refuse until it passes. Fix it; do not re-declare it.',
        );
      }
      // Recording a failure is a SUCCESSFUL record. Exiting 1 here makes the
      // package script fail with an error block and makes honest recording
      // unusable under `set -e`, penalising the exact behaviour the ledger
      // exists for. `ship` is where a red gate stops the work.
      return 0;
    }
    case 'can-skip': {
      const gate = arg(args, 'gate') || args[0];
      if (!gate) throw new Error('can-skip needs --gate <name>');
      const { skippable, reason } = canSkip(ledger, gate, workspaceSignature());
      console.log(reason);
      return skippable ? 0 : 1;
    }
    case 'round': {
      const next = nextRound(ledger);
      saveLedger(next);
      console.log(`round ${next.round} of ${next.bound} (${next.tier} tier)`);
      return 0;
    }
    case 'reviewers': {
      const match = requiredReviewers({});
      console.log(JSON.stringify(match, null, 2));
      return 0;
    }
    case 'ship': {
      const { ready, problems } = shipReadiness(ledger, workspaceSignature());
      if (ready) {
        console.log(
          `green: ${ledger.gates.length} gate(s) passed at the current workspace signature.`,
        );
        return 0;
      }
      console.error('not green:');
      for (const p of problems) console.error(`  - ${p}`);
      return 1;
    }
    case 'status': {
      if (!ledger.task) {
        console.log(
          'No task open. Start one: pnpm zeus:gate start --task "..." --risk <r> --tier <t>',
        );
        return 0;
      }
      const signature = workspaceSignature();
      console.log(`task:  ${ledger.task}`);
      console.log(
        `risk:  ${ledger.risk}   tier: ${ledger.tier}   round ${ledger.round} of ${ledger.bound}`,
      );
      console.log(`blast: ${ledger.blastRadius ?? 'unrecorded'}`);
      if (ledger.gates.length === 0) console.log('gates: none recorded yet');
      for (const g of ledger.gates) {
        const state = g.outcome !== 'pass' ? 'FAIL' : g.signature === signature ? 'pass' : 'STALE';
        console.log(
          `  [${state.padEnd(5)}] ${g.gate}  (round ${g.round})${g.evidence ? ` - ${g.evidence}` : ''}`,
        );
      }
      const { ready, problems } = shipReadiness(ledger, signature);
      console.log(ready ? '\nship: green' : `\nship: blocked\n  - ${problems.join('\n  - ')}`);
      return 0;
    }
    case 'clear': {
      // Guarded: clear discards every recorded gate, so an unguarded one-liner
      // is a way to make a red ledger green by forgetting it. Name what is lost.
      if (!args.includes('--yes')) {
        const passed = ledger.gates.filter((g) => g.outcome === 'pass').length;
        const failed = ledger.gates.length - passed;
        console.error(
          `clear would discard ${ledger.gates.length} recorded gate(s) ` +
            `(${passed} pass, ${failed} fail) for "${ledger.task ?? 'no open task'}". ` +
            'Re-run with --yes if that is what you want. Clearing is not a way to pass a gate.',
        );
        return 1;
      }
      rmSync(ledgerPath(), { force: true });
      console.log('gate ledger cleared.');
      return 0;
    }
    default:
      console.error(USAGE);
      return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(2);
  }
}
