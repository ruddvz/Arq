#!/usr/bin/env node
// Zeus 5 gate ledger: loop bounds and gate results recorded rather than claimed.
//
// The evidence ledger records what each claim rests on. This ledger records
// which gates actually ran, at which round and workspace fingerprint. Repository
// intelligence may add obligations here, but it never replaces the repository
// gate set, reviewer matching or Engineering OS merge authority.

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { agentRegistry } from './zeus-agent-registry.mjs';
import { requiredReviewers } from './zeus-reviewer-match.mjs';
import { applyGraphEscalation, repositoryEvidence } from './lib/zeus-repository-evidence.mjs';
import {
  graphLedgerState,
  graphStateProblems,
  missingGraphChecks,
  requiredGraphChecks,
} from './lib/zeus-repository-ledger.mjs';

const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));

/** Zeus's own risk vocabulary. `moderate`, not the reference system's `medium`. */
const RISKS = ['low', 'moderate', 'high', 'critical'];
const RISK_SET = new Set(RISKS);
const RISK_RANK = { low: 0, moderate: 1, high: 2, critical: 3 };
const TIERS = new Set(['fast', 'standard', 'deep']);
const TIER_RANK = { fast: 0, standard: 1, deep: 2 };
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

function higher(current, candidate, rank) {
  if (!(candidate in rank)) return current;
  if (!(current in rank)) return candidate;
  return rank[candidate] > rank[current] ? candidate : current;
}

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
  const quorum = g.reviewQuorumWhenUnmatched;
  if (!quorum || typeof quorum !== 'object') {
    throw new Error('.zeus/config.json gates.reviewQuorumWhenUnmatched is missing');
  }
  for (const risk of RISKS) {
    if (!Number.isInteger(quorum[risk]) || quorum[risk] < 1) {
      throw new Error(`gates.reviewQuorumWhenUnmatched.${risk} is not a positive integer`);
    }
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

/** Every blast radius level on disk, so `start` cannot accept an invented one. */
export function allRadii(root = packageRoot) {
  try {
    const blast = JSON.parse(readFileSync(join(root, '.zeus', 'blast-radius.json'), 'utf8'));
    return new Set((blast.levels ?? []).map((l) => l.id));
  } catch (error) {
    throw new Error(`cannot read .zeus/blast-radius.json - ${error.message}`);
  }
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

/**
 * The workspace signature, from Zeus's existing fingerprint script.
 * Rooted at the repository, never process.cwd().
 */
export function repositoryRoot(from = packageRoot) {
  const r = spawnSync('git', ['-C', from, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : from;
}

export function workspaceSignature(root = repositoryRoot()) {
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
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  renameSync(tmp, path);
  return ledger;
}

export function startTask(
  ledger,
  { task, risk, tier, blastRadius, bounds, radii = null, repositoryIntelligence = null },
) {
  if (!task) throw new Error('start requires --task "<name>"');
  if (!RISK_SET.has(risk)) throw new Error(`risk must be one of ${RISKS.join('|')}`);
  if (!TIERS.has(tier)) throw new Error(`tier must be one of ${[...TIERS].join('|')}`);
  const known = radii ?? allRadii();
  if (!known.has(blastRadius)) {
    throw new Error(
      `blast radius must be one of ${[...known].join('|')} (from .zeus/blast-radius.json). ` +
        'It is half the review rule, so it cannot be left unrecorded.',
    );
  }
  const next = {
    ...emptyLedger(),
    task,
    risk,
    tier,
    blastRadius,
    round: 1,
    bound: bounds[tier],
    startedAt: now(),
  };
  if (repositoryIntelligence) next.repositoryIntelligence = repositoryIntelligence;
  return next;
}

export function recordGate(ledger, { gate, outcome, evidence, signature }) {
  if (!ledger.task) {
    throw new Error('no task open - run: pnpm zeus:gate start --task "..." --risk <r> --tier <t>');
  }
  if (!gate) throw new Error('record requires --gate <name>');
  if (!OUTCOMES.has(outcome)) throw new Error(`outcome must be ${[...OUTCOMES].join('|')}`);
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
  const gates = ledger.gates.filter((g) => g.gate !== gate);
  gates.push(entry);
  return { ledger: { ...ledger, gates }, entry };
}

/**
 * A gate may be skipped only if it passed at the current signature.
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

/** Whether this ledger's risk and blast radius require independent review. */
export function reviewRequired(
  ledger,
  { config = gateConfig(), radii = reviewRequiringRadii() } = {},
) {
  if (config.reviewRequiredAtRisk.includes(ledger.risk)) return true;
  if (radii === null) return true;
  if (!ledger.blastRadius) return true;
  return radii.has(ledger.blastRadius);
}

function effectiveGraphLedger(ledger, graphState) {
  if (!graphState) return ledger;
  const escalated = applyGraphEscalation(
    { risk: ledger.risk, tier: ledger.tier, checks: [] },
    {
      verification: graphState.verification,
      uncertainty: graphState.uncertainty || graphState.completeness !== 'complete',
    },
  );
  return {
    ...ledger,
    risk: higher(ledger.risk, escalated.risk, RISK_RANK),
    tier: higher(ledger.tier, escalated.tier, TIER_RANK),
  };
}

/**
 * Ship readiness. Repository gates are unconditional. Graph requirements are
 * additive and may only make this result stricter.
 */
export function shipReadiness(ledger, signature, deps = {}) {
  const problems = [];
  if (!ledger.task) return { ready: false, problems: ['no task open - nothing was gated'] };

  const config = deps.config ?? gateConfig();
  const slots = config.repositoryGates;
  const graphState = deps.graphState ?? null;
  const effectiveLedger = effectiveGraphLedger(ledger, graphState);

  if (ledger.gates.length === 0) {
    problems.push('no gate has run - "verified" would be a claim, not a fact');
  }
  for (const g of ledger.gates) {
    if (g.outcome !== 'pass') {
      problems.push(`${g.gate} is not passing (round ${g.round}, outcome "${g.outcome}")`);
    } else if (g.signature !== signature) {
      problems.push(`${g.gate} passed against an older workspace - re-run it`);
    }
  }

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

  if (ledger.repositoryIntelligence) {
    if (!graphState) {
      problems.push('repository graph requirements were recorded at start but cannot be re-evaluated');
    } else {
      if (graphState.fingerprint !== ledger.repositoryIntelligence.fingerprint) {
        problems.push('repository graph fingerprint changed since gate start - restart or re-evaluate the task');
      }
      problems.push(
        ...graphStateProblems(graphState, deps.allowedGraphProvenance ?? [], {
          protectedOnly: true,
        }),
      );
      const graphMissing = missingGraphChecks(
        ledger.gates,
        requiredGraphChecks(graphState),
        signature,
      );
      if (graphMissing.length) {
        problems.push(
          `repository graph requires current passing gate(s): ${graphMissing.join(', ')}`,
        );
      }
    }
  }

  if (
    reviewRequired(effectiveLedger, {
      config,
      radii: deps.radii ?? reviewRequiringRadii(),
    })
  ) {
    const registry = deps.reviewers ? null : agentRegistry();
    const known = deps.reviewers ?? registry.dispatchable;
    if (registry && !registry.exists) {
      problems.push(
        '.claude/agents/ is unreadable, so no review can be verified - run from the repository root',
      );
    }

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

    const passedNow = new Set(
      reviews
        .filter((g) => g.outcome === 'pass' && g.signature === signature)
        .map(nameOf)
        .filter((n) => known.has(n)),
    );
    if (match.matched) {
      const absent = match.required.filter((r) => !passedNow.has(r));
      if (absent.length) {
        problems.push(
          `these reviewers have not passed at this workspace: ${absent.join(', ')} - ` +
            `the changed paths call for all of ${match.required.join(', ')} (${match.reason})`,
        );
      }
    } else {
      const need = config.reviewQuorumWhenUnmatched[effectiveLedger.risk] ?? 1;
      if (passedNow.size < need) {
        problems.push(
          `${effectiveLedger.risk} risk needs ${need} independent review(s) and ${passedNow.size} passed at this workspace - ` +
            `the changed paths could not be resolved to reviewers (${match.reason}), so the count applies instead`,
        );
      }
    }

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
        `${effectiveLedger.risk} risk / ${effectiveLedger.blastRadius ?? 'unrecorded'} blast radius requires independent review and none was recorded - dispatch ${who}, then: ` +
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

  return { ready: problems.length === 0, problems, effectiveLedger };
}

/* --------------------------------- CLI ---------------------------------- */

function arg(args, name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
}

function values(args, name) {
  return args.flatMap((value, index) =>
    value === `--${name}` && args[index + 1] ? [args[index + 1]] : [],
  );
}

function graphForStart(args) {
  const seeds = values(args, 'graph-seed');
  if (!seeds.length) return null;
  const risk = arg(args, 'risk');
  const tier = arg(args, 'tier');
  if (!RISK_SET.has(risk) || !TIERS.has(tier)) return null;

  const root = repositoryRoot();
  const initial = repositoryEvidence(root, seeds, tier);
  const escalated = applyGraphEscalation({ risk, tier, checks: [] }, initial);
  const effectiveRisk = higher(risk, escalated.risk, RISK_RANK);
  const effectiveTier = higher(tier, escalated.tier, TIER_RANK);
  const finalGraph =
    effectiveTier === tier ? initial : repositoryEvidence(root, seeds, effectiveTier);
  return {
    risk: effectiveRisk,
    tier: effectiveTier,
    state: graphLedgerState(finalGraph, effectiveTier),
  };
}

function currentGraph(ledger) {
  const recorded = ledger.repositoryIntelligence;
  const seeds = recorded?.query?.seeds ?? [];
  if (!recorded || !seeds.length) return null;
  const root = repositoryRoot();
  const graph = repositoryEvidence(root, seeds, ledger.tier ?? recorded.tier ?? 'standard');
  return {
    state: graphLedgerState(graph, ledger.tier ?? recorded.tier ?? 'standard'),
    allowedProvenance: graph.source?.provenance ?? [],
  };
}

const USAGE = `Zeus gate ledger - loop bounds and gate results, recorded rather than claimed.

Usage:
  pnpm zeus:gate start --task "<name>" --risk <low|moderate|high|critical> --tier <fast|standard|deep> --blast-radius <id> [--graph-seed <seed> ...]
  pnpm zeus:gate record --gate <name> --outcome <pass|fail> --evidence "<proof>"
  pnpm zeus:gate can-skip --gate <name>   exit 0 only if it passed and nothing changed
  pnpm zeus:gate round                    next repair round; refuses past the tier budget
  pnpm zeus:gate ship                     exit 0 only when green
  pnpm zeus:gate status
  pnpm zeus:gate reviewers                who the current changed paths call for
  pnpm zeus:gate clear --yes              discards every recorded gate

Repository intelligence is additive. When start records --graph-seed values,
ship re-runs that exact seed query, requires the current graph fingerprint and
all graph verification checks, and fails closed for protected stale, unresolved,
truncated or non-hard-gate provenance. It never removes repository gates.

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
      const graph = graphForStart(args);
      const requestedRisk = arg(args, 'risk');
      const requestedTier = arg(args, 'tier');
      const next = startTask(ledger, {
        task: arg(args, 'task'),
        risk: graph?.risk ?? requestedRisk,
        tier: graph?.tier ?? requestedTier,
        blastRadius: arg(args, 'blast-radius'),
        bounds: loopBounds(),
        repositoryIntelligence: graph?.state ?? null,
      });
      saveLedger(next);
      console.log(
        `gate ledger open: "${next.task}" (${next.risk} risk, ${next.tier} tier, round 1 of ${next.bound})`,
      );
      if (graph) {
        console.log(
          `repository graph: ${graph.state.completeness}; frontier ${graph.state.verification.level}; ` +
            `${graph.state.query.seeds.length} seed(s)`,
        );
      }
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
      const graph = currentGraph(ledger);
      const { ready, problems } = shipReadiness(ledger, workspaceSignature(), {
        graphState: graph?.state ?? null,
        allowedGraphProvenance: graph?.allowedProvenance ?? [],
      });
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
      const graph = currentGraph(ledger);
      console.log(`task:  ${ledger.task}`);
      console.log(
        `risk:  ${ledger.risk}   tier: ${ledger.tier}   round ${ledger.round} of ${ledger.bound}`,
      );
      console.log(`blast: ${ledger.blastRadius ?? 'unrecorded'}`);
      if (ledger.repositoryIntelligence) {
        console.log(
          `graph: ${graph?.state?.fresh ? 'fresh' : 'stale/unavailable'}   ` +
            `frontier: ${graph?.state?.verification?.level ?? 'unknown'}   ` +
            `completeness: ${graph?.state?.completeness ?? 'unresolved'}`,
        );
      }
      if (ledger.gates.length === 0) console.log('gates: none recorded yet');
      for (const g of ledger.gates) {
        const state = g.outcome !== 'pass' ? 'FAIL' : g.signature === signature ? 'pass' : 'STALE';
        console.log(
          `  [${state.padEnd(5)}] ${g.gate}  (round ${g.round})${g.evidence ? ` - ${g.evidence}` : ''}`,
        );
      }
      const { ready, problems } = shipReadiness(ledger, signature, {
        graphState: graph?.state ?? null,
        allowedGraphProvenance: graph?.allowedProvenance ?? [],
      });
      console.log(ready ? '\nship: green' : `\nship: blocked\n  - ${problems.join('\n  - ')}`);
      return 0;
    }
    case 'clear': {
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
