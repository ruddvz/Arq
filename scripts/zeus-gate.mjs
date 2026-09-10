#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { applyGraphEscalation, repositoryEvidence } from './lib/zeus-repository-evidence.mjs';
import {
  graphLedgerState,
  graphStateProblems,
  missingGraphChecks,
  requiredGraphChecks,
} from './lib/zeus-repository-ledger.mjs';
import {
  loadLedger,
  main as ledgerMain,
  repositoryRoot,
  saveLedger,
  shipReadiness,
  workspaceSignature,
} from './zeus-gate-ledger.mjs';
import { loadConfig } from './zeus-repository-intelligence.mjs';

const RISK_RANK = { low: 0, moderate: 1, high: 2, critical: 3 };
const TIER_RANK = { fast: 0, standard: 1, deep: 2 };

function arg(args, name, fallback = null) {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] !== undefined ? args[index + 1] : fallback;
}

function values(args, name) {
  return args.flatMap((value, index) =>
    value === `--${name}` && args[index + 1] ? [args[index + 1]] : [],
  );
}

function replaceArg(args, name, value) {
  const next = [...args];
  const index = next.indexOf(`--${name}`);
  if (index >= 0) next[index + 1] = value;
  else next.push(`--${name}`, value);
  return next;
}

function higher(current, candidate, rank) {
  if (!(candidate in rank)) return current;
  if (!(current in rank)) return candidate;
  return rank[candidate] > rank[current] ? candidate : current;
}

export function graphAwareShipReadiness(ledger, signature, graphState, deps = {}) {
  const effectiveLedger = { ...ledger };
  if (graphState) {
    const escalated = applyGraphEscalation(
      {
        risk: effectiveLedger.risk,
        tier: effectiveLedger.tier,
        checks: [],
      },
      {
        verification: graphState.verification,
        uncertainty: graphState.uncertainty || graphState.completeness !== 'complete',
      },
    );
    effectiveLedger.risk = higher(effectiveLedger.risk, escalated.risk, RISK_RANK);
    effectiveLedger.tier = higher(effectiveLedger.tier, escalated.tier, TIER_RANK);
  }

  const base = shipReadiness(effectiveLedger, signature, deps);
  const problems = [...base.problems];

  if (graphState) {
    problems.push(
      ...graphStateProblems(graphState, deps.allowedProvenance ?? [], {
        protectedOnly: true,
        recordedFingerprint: ledger.repositoryIntelligence?.fingerprint ?? null,
      }),
    );
    const missing = missingGraphChecks(
      ledger.gates,
      requiredGraphChecks(graphState),
      signature,
      graphState.fingerprint,
    );
    if (missing.length) {
      problems.push(`repository graph requires current graph-bound passing gate(s): ${missing.join(', ')}`);
    }
  }

  return {
    ready: problems.length === 0,
    problems: [...new Set(problems)],
    effectiveLedger,
  };
}

function graphForStart(args) {
  const seeds = values(args, 'graph-seed');
  const risk = arg(args, 'risk');
  const tier = arg(args, 'tier');
  if (!seeds.length || !risk || !tier) return null;

  const root = repositoryRoot();
  const initial = repositoryEvidence(root, seeds, tier);
  const escalated = applyGraphEscalation({ risk, tier, checks: [] }, initial);
  const finalGraph = escalated.tier === tier ? initial : repositoryEvidence(root, seeds, escalated.tier);

  return {
    state: graphLedgerState(finalGraph, escalated.tier),
    risk: higher(risk, escalated.risk, RISK_RANK),
    tier: higher(tier, escalated.tier, TIER_RANK),
  };
}

function currentGraphState(ledger) {
  const seeds = ledger.repositoryIntelligence?.query?.seeds ?? [];
  if (!seeds.length) return null;
  const root = repositoryRoot();
  const graph = repositoryEvidence(root, seeds, ledger.tier ?? 'standard');
  return graphLedgerState(graph, ledger.tier ?? 'standard');
}

function graphConfig() {
  return loadConfig(repositoryRoot());
}

export function main(argv) {
  const [command, ...args] = argv;

  if (command === 'start') {
    const graph = graphForStart(args);
    if (!graph) return ledgerMain(argv);

    let nextArgs = replaceArg(args, 'risk', graph.risk);
    nextArgs = replaceArg(nextArgs, 'tier', graph.tier);
    const result = ledgerMain(['start', ...nextArgs]);
    if (result !== 0) return result;

    const ledger = loadLedger();
    saveLedger({ ...ledger, repositoryIntelligence: graph.state });
    console.log(
      `repository graph: ${graph.state.completeness}; ` +
        `frontier ${graph.state.verification.level}; ${graph.state.query.seeds.length} seed(s)`,
    );
    return 0;
  }

  if (command === 'record') {
    const ledger = loadLedger();
    if (!ledger.repositoryIntelligence) return ledgerMain(argv);

    const graphState = currentGraphState(ledger);
    const allowedProvenance = graphConfig().hard_gate_provenance ?? [];
    const outcome = arg(args, 'outcome');
    if (outcome === 'pass') {
      const graphProblems = graphStateProblems(graphState, allowedProvenance, {
        protectedOnly: true,
      });
      if (graphProblems.length) {
        console.error(`cannot record a passing graph-bound gate: ${graphProblems.join('; ')}`);
        return 1;
      }
    }

    const result = ledgerMain(argv);
    if (result !== 0) return result;

    const gate = arg(args, 'gate');
    if (!gate) return result;
    const next = loadLedger();
    const gates = next.gates.map((entry) =>
      entry.gate === gate ? { ...entry, repositoryGraph: graphState } : entry,
    );
    saveLedger({ ...next, repositoryIntelligence: graphState, gates });
    return 0;
  }

  if (command === 'ship') {
    const ledger = loadLedger();
    if (!ledger.repositoryIntelligence) return ledgerMain(argv);

    const signature = workspaceSignature();
    const graphState = currentGraphState(ledger);
    const config = graphConfig();
    const { ready, problems, effectiveLedger } = graphAwareShipReadiness(
      ledger,
      signature,
      graphState,
      {
        allowedProvenance: config.hard_gate_provenance ?? [],
      },
    );

    if (ready) {
      console.log(
        `green: ${ledger.gates.length} gate(s) passed at the current workspace signature; ` +
          `repository graph frontier ${graphState.verification.level} is satisfied.`,
      );
      return 0;
    }

    console.error('not green:');
    for (const problem of problems) console.error(`  - ${problem}`);
    if (effectiveLedger.risk !== ledger.risk || effectiveLedger.tier !== ledger.tier) {
      console.error(
        `  - repository graph raises this gate to ${effectiveLedger.risk} risk / ` +
          `${effectiveLedger.tier} tier for ship evaluation`,
      );
    }
    return 1;
  }

  return ledgerMain(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(String(error.message ?? error));
    process.exit(2);
  }
}
