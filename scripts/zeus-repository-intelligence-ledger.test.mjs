import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { repositoryEvidence } from './lib/zeus-repository-evidence.mjs';
import {
  graphLedgerState,
  graphStateProblems,
} from './lib/zeus-repository-ledger.mjs';
import { graphAwareShipReadiness } from './zeus-gate.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const graphScript = path.join(root, 'scripts', 'zeus-repository-intelligence.mjs');
const evidenceScript = path.join(root, 'scripts', 'zeus-evidence.mjs');
const seed = '.zeus/repository-graph.json';
const hardProvenance = ['deterministic', 'declared'];

function run(script, args, { expect = 0, env = {} } = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env },
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(
    result.status,
    expect,
    `expected exit ${expect}, got ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function restoreFile(file, before) {
  if (before === null) rmSync(file, { force: true });
  else writeFileSync(file, before);
}

run(graphScript, ['--json', 'build']);

const graph = repositoryEvidence(root, [seed], 'standard');
const graphState = graphLedgerState(graph, 'standard');
assert.equal(graphState.fresh, true);
assert.equal(graphState.completeness, 'complete');
assert.equal(graphState.query.kind, 'seed');
assert.deepEqual(graphState.query.seeds, [seed]);
assert.ok(graphState.fingerprint);
assert.ok(graphState.sourceRevision);
assert.ok(graphState.branch);
assert.deepEqual(graphState.resolution.unresolved, []);
assert.deepEqual(graphState.resolution.ambiguous, {});
assert(graphState.provenance.includes('deterministic'));

// Mutable ZEUS runtime ledgers are outputs, not repository source. Writing them
// must not invalidate graph-derived claims by changing the source-state digest.
const runtimeFiles = [
  path.join(root, '.zeus', 'evidence-ledger.json'),
  path.join(root, '.zeus', 'gates', 'current.json'),
];
const runtimeBackups = runtimeFiles.map((file) =>
  existsSync(file) ? readFileSync(file) : null,
);
try {
  mkdirSync(path.dirname(runtimeFiles[1]), { recursive: true });
  writeFileSync(runtimeFiles[0], '{"runtime":"evidence"}\n');
  writeFileSync(runtimeFiles[1], '{"runtime":"gates"}\n');
  const afterRuntimeWrites = repositoryEvidence(root, [seed], 'standard');
  assert.equal(afterRuntimeWrites.fresh, true);
  assert.equal(afterRuntimeWrites.fingerprint, graphState.fingerprint);
} finally {
  runtimeFiles.forEach((file, index) => restoreFile(file, runtimeBackups[index]));
}

// Graph-derived verified evidence must record the exact current graph binding.
const temp = mkdtempSync(path.join(os.tmpdir(), 'zeus-repository-ledger-'));
const ledgerFile = path.join(temp, 'evidence.json');
run(evidenceScript, ['init', '--root', root, '--file', ledgerFile, '--task', 'graph evidence']);
run(evidenceScript, [
  'add',
  '--root',
  root,
  '--file',
  ledgerFile,
  '--claim',
  'repository graph configuration is current',
  '--state',
  'verified',
  '--command',
  'node scripts/zeus-repository-intelligence.mjs --json status',
  '--exit',
  '0',
  '--graph-seed',
  seed,
  '--graph-tier',
  'standard',
]);
const recorded = JSON.parse(readFileSync(ledgerFile, 'utf8')).entries[0];
assert.equal(recorded.repositoryGraph.fingerprint, graphState.fingerprint);
assert.equal(recorded.repositoryGraph.sourceRevision, graphState.sourceRevision);
assert.equal(recorded.repositoryGraph.branch, graphState.branch);
assert.deepEqual(recorded.repositoryGraph.query.seeds, [seed]);
assert.equal(recorded.repositoryGraph.completeness, 'complete');

// A relevant uncommitted source edit must make new verified graph evidence fail
// closed until the graph is recomputed and the claim is re-verified.
const staleProbe = path.join(root, 'scripts', '__zeus_graph_ledger_stale_probe__.mjs');
try {
  writeFileSync(staleProbe, 'export const graphLedgerStaleProbe = true;\n');
  const stale = repositoryEvidence(root, [seed], 'standard');
  assert.equal(stale.fresh, false);
  const rejected = spawnSync(
    process.execPath,
    [
      evidenceScript,
      'add',
      '--root',
      root,
      '--file',
      ledgerFile,
      '--claim',
      'stale graph must not verify',
      '--state',
      'verified',
      '--command',
      'node scripts/zeus-repository-intelligence.mjs --json status',
      '--exit',
      '0',
      '--graph-seed',
      seed,
    ],
    { cwd: root, encoding: 'utf8' },
  );
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /stale|unresolved/i);
} finally {
  rmSync(staleProbe, { force: true });
}
run(evidenceScript, ['report', '--root', root, '--file', ledgerFile]);

// Inferred-only graph facts cannot be promoted into verified evidence.
const protectedBase = {
  ...graphState,
  fresh: true,
  uncertainty: false,
  completeness: 'complete',
  resolution: { resolved: ['file:fixture'], unresolved: [], ambiguous: {} },
  truncation: { context: false, impact: false },
  verification: {
    level: 'protected',
    uncertain: false,
    domains: ['semantic_model'],
    commands: ['pnpm zeus:validate', 'pnpm lint', 'pnpm typecheck', 'pnpm test', 'pnpm build'],
  },
};
const inferredProblems = graphStateProblems(
  { ...protectedBase, provenance: ['inferred'] },
  hardProvenance,
  { requireHardProvenance: true },
);
assert(inferredProblems.some((problem) => /non-hard-gate provenance/.test(problem)));

// Truncated protected-domain context is uncertainty, never proof of a gate.
const truncatedProblems = graphStateProblems(
  {
    ...protectedBase,
    completeness: 'truncated',
    provenance: ['deterministic'],
    truncation: { context: true, impact: false },
  },
  hardProvenance,
);
assert(truncatedProblems.some((problem) => /truncated/.test(problem)));

// Ship requires graph-selected checks to be both current in the workspace and
// bound to the current graph fingerprint. A newer graph invalidates old graph
// gate bindings even if their ordinary workspace signature is unchanged.
const signature = 'workspace-fixture';
const graphForGate = {
  ...protectedBase,
  fingerprint: 'graph-a',
  provenance: ['deterministic'],
};
const requiredGates = ['format:check', 'lint', 'typecheck', 'test', 'build', 'zeus:validate'];
const gates = requiredGates.map((gate) => ({
  gate,
  outcome: 'pass',
  evidence: `${gate} passed`,
  round: 1,
  signature,
  repositoryGraph: { fingerprint: 'graph-a' },
}));
const gateLedger = {
  version: 1,
  task: 'graph-aware gate',
  risk: 'low',
  tier: 'fast',
  blastRadius: 'local',
  round: 1,
  bound: 2,
  repositoryIntelligence: graphForGate,
  gates,
};
const gateDeps = {
  allowedProvenance: hardProvenance,
  config: {
    repositoryGates: ['format:check', 'lint', 'typecheck', 'test', 'build'],
    reviewRequiredAtRisk: [],
    reviewQuorumWhenUnmatched: { low: 1, moderate: 1, high: 1, critical: 1 },
  },
  radii: new Set(),
};
assert.equal(
  graphAwareShipReadiness(gateLedger, signature, graphForGate, gateDeps).ready,
  true,
);
const changedGraph = { ...graphForGate, fingerprint: 'graph-b' };
const changedReadiness = graphAwareShipReadiness(
  gateLedger,
  signature,
  changedGraph,
  gateDeps,
);
assert.equal(changedReadiness.ready, false);
assert(
  changedReadiness.problems.some((problem) =>
    /fingerprint changed|graph-bound passing gate/.test(problem),
  ),
);

rmSync(temp, { recursive: true, force: true });
console.log('ZEUS repository-intelligence ledger regressions passed.');
