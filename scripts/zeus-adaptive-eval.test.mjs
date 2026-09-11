#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  REPRESENTATIVE_SCENARIOS,
  evaluateRepresentativeScenarios,
} from './zeus-adaptive-eval.mjs';

const report = evaluateRepresentativeScenarios();
assert.equal(report.ok, true, JSON.stringify(report.assertions, null, 2));
for (const metric of ['contextChars', 'sources', 'toolCalls']) {
  const measured = report.fast_standard_average[metric];
  assert.ok(measured.adaptive < measured.baseline, `${metric} did not decrease`);
  assert.ok(measured.reduction > 0, `${metric} reduction must be positive`);
}
assert.ok(
  report.results
    .filter((result) => result.class === 'fast-standard')
    .every((result) => result.baseline_quality_green && result.adaptive_quality_green),
);
assert.ok(
  report.results
    .filter((result) => result.class === 'protected-deep')
    .every(
      (result) =>
        result.baseline.contextChars === result.adaptive.contextChars &&
        result.baseline.sources === result.adaptive.sources &&
        result.baseline.toolCalls === result.adaptive.toolCalls &&
        result.baseline_quality_green &&
        result.adaptive_quality_green,
    ),
);

const noPruning = structuredClone(REPRESENTATIVE_SCENARIOS);
for (const scenario of noPruning.filter((candidate) => candidate.class === 'fast-standard')) {
  for (const operation of scenario.operations) operation.expectedDecisionValue = true;
}
const noPruningReport = evaluateRepresentativeScenarios(noPruning);
assert.equal(noPruningReport.ok, false);
assert.equal(
  noPruningReport.assertions.find(
    (assertion) =>
      assertion.id === 'fast-standard-average-context-source-tool-consumption-is-lower',
  )?.pass,
  false,
);

const weakenedProtected = structuredClone(REPRESENTATIVE_SCENARIOS);
const protectedScenario = weakenedProtected.find(
  (scenario) => scenario.id === 'arq-migration-deep-protected',
);
assert.ok(protectedScenario);
protectedScenario.operations[0].protectedProof = false;
protectedScenario.operations[0].protectedEvidence = false;
protectedScenario.operations[0].expectedDecisionValue = false;
const weakenedProtectedReport = evaluateRepresentativeScenarios(weakenedProtected);
assert.equal(weakenedProtectedReport.ok, false);
assert.equal(
  weakenedProtectedReport.assertions.find(
    (assertion) => assertion.id === 'deep-protected-work-is-not-pruned',
  )?.pass,
  false,
);

console.log('ZEUS adaptive representative eval regressions: PASS');
