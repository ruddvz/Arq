import assert from 'node:assert/strict';
import {
  DOCTOR_SCHEMA,
  NEXT_ACTIONS,
  arqImplications,
  buildDoctorReport,
  chooseNextAction,
  computeOverallStatus,
  formatHuman,
  relevantInvariants,
} from './zeus-doctor.mjs';

const baseFacts = () => ({
  failures: [],
  hardBlockers: [],
  task: 'Implement the renderer fix',
  diff: { complete: true, baseReason: 'origin/HEAD' },
  graph: { uncertainty: false, truncated: false },
  planBlocked: false,
  staleEvidence: [],
  runState: null,
  planNext: null,
  evidence: { exists: false, status: 'not-inspected' },
  plan: { exists: false, ready: true },
  engineeringOs: { ready: false },
  review: { required: [] },
  reviewCurrent: true,
  currentBranch: 'feature/doctor',
  baseBranch: 'main',
  overallStatus: 'partial',
  needsReview: false,
});

const actionCases = [
  ['INSPECT', { task: null }],
  ['NARROW', { diff: { complete: false, baseReason: 'base unresolved' } }],
  [
    'IMPLEMENT',
    {
      planNext: {
        id: 'i1',
        state: 'active',
        title: 'Implement status command',
        acceptance: 'tests pass',
      },
    },
  ],
  [
    'BENCHMARK',
    {
      planNext: {
        id: 'i2',
        state: 'active',
        title: 'Measure renderer performance',
        acceptance: 'benchmark latency',
      },
    },
  ],
  ['TEST', { staleEvidence: ['gate stale: test'] }],
  ['FIX', { failures: ['gate failed: test'] }],
  ['REVIEW', { needsReview: true }],
  ['OPEN PR', { engineeringOs: { ready: true } }],
  ['WAIT', { runState: { state: 'ci_running' } }],
  ['RELEASE', { runState: { state: 'ci_green' }, engineeringOs: { ready: true } }],
];

for (const [expected, patch] of actionCases) {
  const facts = { ...baseFacts(), ...patch };
  const actual = chooseNextAction(facts);
  assert.equal(actual.action, expected, `${expected}: ${actual.reason}`);
}
assert.deepEqual(
  [...new Set(actionCases.map(([action]) => action))].sort(),
  [...NEXT_ACTIONS].sort(),
  'every allowed next action must have a deterministic regression case',
);

{
  const facts = baseFacts();
  facts.engineeringOs = { ready: true };
  facts.deliveryStatus = 'partial';
  assert.equal(computeOverallStatus(facts), 'green');
  facts.engineeringOs = { ready: false };
  assert.equal(computeOverallStatus(facts), 'partial');
  facts.hardBlockers = ['canonical base unresolved'];
  assert.equal(computeOverallStatus(facts), 'blocked');
  facts.hardBlockers = [];
  facts.failures = ['test failed'];
  assert.equal(computeOverallStatus(facts), 'failed');
}

{
  const invariants = relevantInvariants([
    'packages/arqfs/src/open.ts',
    'packages/geometry-2d/src/line.ts',
    'apps/web/src/editor.tsx',
  ]);
  assert(invariants.includes('D. `.arq` file, storage and migration'));
  assert(invariants.includes('E. Geometry and numerics'));
  assert(invariants.includes('K. UI, accessibility and language'));
  const arq = arqImplications(['packages/arqfs/src/open.ts']);
  assert.equal(arq.applies, true);
  assert.equal(arq.requirements.length, 3);
}

{
  const facts = {
    ...baseFacts(),
    root: '/repo',
    base: 'origin/main',
    baseBranch: 'main',
    currentBranch: 'feature/doctor',
    head: 'abc123',
    drift: { ahead: 2, behind: 0 },
    dirty: [],
    files: ['scripts/zeus-doctor.mjs'],
    packages: [],
    languages: ['JavaScript'],
    gateTask: 'Implement doctor status',
    axes: {
      mode: 'implement',
      risk: 'high',
      tier: 'deep',
      blastRadius: 'workspace',
      reversibility: 'reversible',
      deliveryStop: 'local-green',
    },
    invariants: ['A. Source authority and truth', 'L. Delivery and evidence'],
    arq: { applies: false, affectedFiles: [], requirements: [] },
    graph: {
      authority: 'advisory-navigation-only',
      fresh: true,
      reason: 'fresh',
      uncertainty: false,
      truncated: false,
      nodeCount: 4,
      domains: ['harness'],
      verificationFrontier: 'harness',
    },
    evidence: { exists: false, status: 'not-inspected', counts: {}, failures: [], blocked: [] },
    plan: { exists: false, task: null, ready: true, problems: [], items: [], next: null },
    review: { required: ['systems-reviewer'], modules: ['architecture'], unknownReviewers: [] },
    reviewCurrent: true,
    engineeringOs: {
      authority: 'Engineering OS 5.0',
      status: 'green',
      ready: true,
      requiredGates: ['format:check', 'lint', 'typecheck', 'test', 'build'],
      problems: [],
    },
    needsReview: false,
    hardBlockers: [],
    failures: [],
    staleEvidence: [],
    advisories: [],
    deliveryStatus: 'partial',
  };
  const report = buildDoctorReport(facts);
  assert.equal(report.schema, DOCTOR_SCHEMA);
  assert.equal(report.status, 'green');
  assert.equal(report.nextAction, 'OPEN PR');
  const snapshot = formatHuman(report);
  assert.equal(
    snapshot,
    [
      'ZEUS doctor: GREEN',
      'Task: Implement the renderer fix',
      'Branch: feature/doctor -> main',
      'Drift: ahead=2 behind=0',
      'Axes: mode=implement risk=high tier=deep blast=workspace reversibility=reversible',
      'Impact: 1 files, 0 packages, JavaScript',
      'Files: scripts/zeus-doctor.mjs',
      'Invariants: A. Source authority and truth | L. Delivery and evidence; .arq=not affected',
      'Graph: fresh, advisory, 4 impacted nodes',
      'Evidence: not-inspected; stale=0; failed=0',
      'Checks: 5 required; reviewers=systems-reviewer',
      'Engineering OS: green',
      'Next: OPEN PR - local evidence is green on a non-canonical branch',
    ].join('\n'),
  );
  assert.equal(snapshot.match(/^Next:/gm)?.length, 1, 'human output must contain exactly one next action');
  assert.equal(/\u001b\[/.test(snapshot), false, 'status meaning must not depend on ANSI colour');
}

console.log('ZEUS doctor status snapshots: PASS');
