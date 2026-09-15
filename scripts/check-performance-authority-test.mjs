#!/usr/bin/env node
import {
  aggregateSamples,
  assertPrivacySafeDiagnostic,
  buildDiagnosticRecord,
  getStartupBundleBudget,
  readPerformanceAuthority,
} from './lib/performance-authority.mjs';

let failures = 0;
function check(description, condition) {
  if (condition) process.stdout.write(`PASS ${description}\n`);
  else {
    failures += 1;
    process.stderr.write(`FAIL ${description}\n`);
  }
}

const authority = readPerformanceAuthority();
check('canonical startup budget resolves', getStartupBundleBudget(authority).threshold === 307200);

const aggregate = aggregateSamples([1, 2, 3, 4, 100]);
check('median is deterministic', aggregate.median === 3);
check('p95 uses the explicit upper-tail statistic', aggregate.p95 === 100);
check('sample count is retained', aggregate.sampleCount === 5);

const safe = buildDiagnosticRecord({
  workflowId: 'plan.first-frame',
  subsystem: 'plan-renderer',
  fixtureId: 'core-workflow-v1',
  repositorySha: 'test-sha',
  coldOrWarm: 'cold',
  environment: { browser: 'test', os: 'test' },
  samples: [{ settledMs: 10 }],
  aggregates: { settledMs: aggregateSamples([10]) },
  counters: { semanticObjects: 1000 },
  bottleneckClasses: ['main-thread'],
});
check('privacy-safe diagnostic is constructible', safe.workflowId === 'plan.first-frame');

let rejected = false;
try {
  assertPrivacySafeDiagnostic({ projectName: 'private name' });
} catch {
  rejected = true;
}
check('private project-name fields are rejected', rejected);

rejected = false;
try {
  assertPrivacySafeDiagnostic({ nested: { geometryPayload: { wall: 'private geometry' } } });
} catch {
  rejected = true;
}
check('nested geometry payload fields are rejected', rejected);

if (failures) process.exit(1);
process.stdout.write('\nPerformance authority self-test passed.\n');
