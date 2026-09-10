import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { graphLedgerState, graphStateProblems } from './lib/zeus-repository-ledger.mjs';
import { graphAwareShipReadiness } from './zeus-gate.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const signature = 'workspace-current';
const allowedProvenance = ['deterministic', 'declared'];
const repositoryGates = ['format:check', 'lint', 'typecheck', 'test', 'build'];
const protectedSeed = 'contracts/performance.ts';
const pass = (gate) => ({
  gate,
  outcome: 'pass',
  evidence: 'synthetic proof',
  round: 1,
  signature,
});

const gateDeps = {
  config: {
    repositoryGates,
    reviewRequiredAtRisk: ['high', 'critical'],
    reviewQuorumWhenUnmatched: { low: 1, moderate: 1, high: 2, critical: 2 },
  },
  radii: new Set(),
  reviewers: new Set(['qa-release']),
  match: {
    matched: true,
    required: ['qa-release'],
    reason: 'synthetic protected graph',
    modules: [],
  },
  allowedProvenance,
};

const protectedGraph = {
  fresh: true,
  uncertainty: false,
  reason: 'fresh',
  fingerprint: 'graph-current',
  source_revision: 'head-sha',
  branch: 'feature',
  seeds: {
    requested: [protectedSeed],
    resolved: [`file:${protectedSeed}`],
    unresolved: [],
    ambiguous: {},
  },
  context: {
    truncated: false,
    edges: [{ provenance: 'deterministic' }],
  },
  impact: {
    truncated: false,
    edges: [{ provenance: 'declared' }],
  },
  verification: {
    level: 'protected',
    uncertain: false,
    domains: ['contract'],
    commands: [
      'pnpm format:check',
      'pnpm lint',
      'pnpm typecheck',
      'pnpm test',
      'pnpm build',
      'pnpm zeus:validate',
    ],
  },
};

const protectedState = graphLedgerState(protectedGraph, 'deep');
assert.deepEqual(protectedState.query.seeds, [protectedSeed]);
assert.deepEqual(protectedState.resolution.unresolved, []);
assert.deepEqual(protectedState.provenance, ['declared', 'deterministic']);
assert.equal(protectedState.complete, true);

const protectedLedger = {
  version: 1,
  task: 'protected graph task',
  risk: 'low',
  tier: 'fast',
  blastRadius: 'local',
  round: 1,
  bound: 2,
  gates: [...repositoryGates.map(pass), pass('zeus:validate'), pass('review:qa-release')],
};

{
  const result = graphAwareShipReadiness(protectedLedger, signature, protectedState, gateDeps);
  assert.equal(result.ready, true, result.problems.join('\n'));
  assert.equal(result.effectiveLedger.risk, 'high');
  assert.equal(result.effectiveLedger.tier, 'deep');
}

{
  const ledger = {
    ...protectedLedger,
    gates: protectedLedger.gates.filter((gate) => gate.gate !== 'zeus:validate'),
  };
  const result = graphAwareShipReadiness(ledger, signature, protectedState, gateDeps);
  assert.equal(result.ready, false);
  assert(
    result.problems.some((problem) => problem.includes('repository graph requires')),
    result.problems.join('\n'),
  );
}

{
  const stale = {
    ...protectedState,
    fresh: false,
    complete: false,
    reason: 'fingerprint-mismatch',
  };
  const result = graphAwareShipReadiness(protectedLedger, signature, stale, gateDeps);
  assert.equal(result.ready, false);
  assert(result.problems.some((problem) => problem.includes('stale or missing')));
}

{
  const inferred = graphLedgerState(
    {
      ...protectedGraph,
      context: {
        truncated: false,
        edges: [{ provenance: 'inferred' }],
      },
      impact: { truncated: false, edges: [] },
    },
    'deep',
  );
  const result = graphAwareShipReadiness(protectedLedger, signature, inferred, gateDeps);
  assert.equal(result.ready, false);
  assert(result.problems.some((problem) => problem.includes('non-hard-gate provenance')));
}

{
  const truncated = graphLedgerState(
    {
      ...protectedGraph,
      uncertainty: true,
      context: { ...protectedGraph.context, truncated: true },
      verification: { ...protectedGraph.verification, uncertain: true },
    },
    'deep',
  );
  assert.equal(truncated.complete, false);
  assert.equal(truncated.truncation.context, true);
  const problems = graphStateProblems(truncated, allowedProvenance, { protectedOnly: true });
  assert(problems.some((problem) => problem.includes('coverage is uncertain')));
  assert(problems.some((problem) => problem.includes('traversal is truncated')));
  const result = graphAwareShipReadiness(protectedLedger, signature, truncated, gateDeps);
  assert.equal(result.ready, false, 'uncertain protected graph coverage must never certify ship');
}

{
  const ordinaryState = graphLedgerState(
    {
      ...protectedGraph,
      verification: {
        level: 'renderer_ui',
        uncertain: false,
        domains: ['renderer'],
        commands: ['pnpm lint'],
      },
    },
    'fast',
  );
  const ledger = {
    ...protectedLedger,
    risk: 'low',
    tier: 'fast',
    gates: repositoryGates.filter((gate) => gate !== 'build').map(pass),
  };
  const result = graphAwareShipReadiness(ledger, signature, ordinaryState, {
    ...gateDeps,
    match: { matched: false, required: [], reason: 'not needed', modules: [] },
  });
  assert.equal(result.ready, false);
  assert(
    result.problems.some((problem) => problem.includes('these gates were never recorded')),
    'ordinary graph evidence must never waive repository gates',
  );
}

function run(script, args, env = process.env) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

const temp = mkdtempSync(path.join(tmpdir(), 'zeus-repository-ledgers-'));
const evidenceFile = path.join(temp, 'evidence.json');
const gateFile = path.join(temp, 'gate.json');
const probe = path.join(root, 'scripts', '__zeus_repository_ledger_stale_probe__.mjs');

try {
  const build = run('scripts/zeus-repository-intelligence.mjs', ['build', '--json']);
  assert.equal(build.status, 0, build.stderr || build.stdout);

  const init = run('scripts/zeus-evidence.mjs', [
    'init',
    '--task',
    'bind a graph-derived claim',
    '--tier',
    'deep',
    '--graph-seed',
    protectedSeed,
    '--file',
    evidenceFile,
  ]);
  assert.equal(init.status, 0, init.stderr || init.stdout);

  const add = run('scripts/zeus-evidence.mjs', [
    'add',
    '--claim',
    'protected graph claim',
    '--state',
    'verified',
    '--command',
    'synthetic-current-head-check',
    '--exit',
    '0',
    '--file',
    evidenceFile,
  ]);
  assert.equal(add.status, 0, add.stderr || add.stdout);

  const evidence = JSON.parse(readFileSync(evidenceFile, 'utf8'));
  const graphBinding = evidence.entries[0].repositoryGraph;
  assert.equal(graphBinding.fingerprint, evidence.repositoryIntelligence.fingerprint);
  assert.deepEqual(graphBinding.query.seeds, [protectedSeed]);
  assert(Array.isArray(graphBinding.provenance));
  assert.equal(typeof graphBinding.complete, 'boolean');
  assert.equal(typeof graphBinding.truncation.context, 'boolean');
  assert.equal(typeof graphBinding.truncation.impact, 'boolean');

  const gateStart = run(
    'scripts/zeus-gate.mjs',
    [
      'start',
      '--task',
      'protected graph gate',
      '--risk',
      'low',
      '--tier',
      'fast',
      '--blast-radius',
      'local',
      '--graph-seed',
      protectedSeed,
    ],
    { ...process.env, ZEUS_GATE_LEDGER: gateFile },
  );
  assert.equal(gateStart.status, 0, gateStart.stderr || gateStart.stdout);
  const gate = JSON.parse(readFileSync(gateFile, 'utf8'));
  assert.equal(gate.risk, 'high');
  assert.equal(gate.tier, 'deep');
  assert.deepEqual(gate.repositoryIntelligence.query.seeds, [protectedSeed]);

  writeFileSync(probe, 'export const repositoryLedgerStaleProbe = true;\n');
  const staleAdd = run('scripts/zeus-evidence.mjs', [
    'add',
    '--claim',
    'stale protected graph claim',
    '--state',
    'verified',
    '--command',
    'synthetic-current-head-check',
    '--exit',
    '0',
    '--file',
    evidenceFile,
  ]);
  assert.notEqual(staleAdd.status, 0);
  assert(staleAdd.stderr.includes('Cannot record graph-derived verified evidence'));
} finally {
  rmSync(probe, { force: true });
  rmSync(temp, { recursive: true, force: true });
}

console.log('ZEUS repository-intelligence ledger regressions passed.');
