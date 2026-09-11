#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  REPRESENTATIVE_SCENARIOS,
  evaluateRepresentativeScenarios,
} from './zeus-adaptive-eval.mjs';

const report = evaluateRepresentativeScenarios();
assert.equal(report.ok, true, JSON.stringify(report.assertions, null, 2));
assert.ok(report.summary.fast_standard.scenarios >= 4);
assert.ok(report.summary.fast_standard.mean_utilization < 0.5);
assert.ok(report.summary.fast_standard.max_utilization <= 0.5);
assert.ok(report.summary.fast_standard.savings_vs_full_ceiling > 0.5);
assert.equal(report.summary.fast_standard.quality_green_rate, 1);
assert.ok(report.summary.protected.successful_scenarios >= 3);
assert.equal(report.summary.protected.quality_green_rate, 1);
assert.ok(report.summary.protected.fail_closed_scenarios >= 1);
assert.equal(report.summary.protected.fail_closed_rate, 1);

const overBudget = structuredClone(REPRESENTATIVE_SCENARIOS);
overBudget[0].input.usage.contextChars = 999999;
const overBudgetReport = evaluateRepresentativeScenarios(overBudget);
assert.equal(overBudgetReport.ok, false);
assert.ok(
  overBudgetReport.results
    .find((result) => result.id === 'readme-typo-fast')
    ?.problems.some((problem) => problem.includes('within_budget')),
);

const deescalatedProtected = structuredClone(REPRESENTATIVE_SCENARIOS);
const migration = deescalatedProtected.find((scenario) => scenario.id === 'arq-migration-deep-protected');
assert.ok(migration);
migration.tier = 'standard';
migration.input.tier = 'standard';
const deescalatedReport = evaluateRepresentativeScenarios(deescalatedProtected);
assert.equal(deescalatedReport.ok, false);
assert.ok(
  deescalatedReport.results
    .find((result) => result.id === 'arq-migration-deep-protected')
    ?.problems.some((problem) => problem.includes('tier standard != expected deep')),
);

const falseGreen = structuredClone(REPRESENTATIVE_SCENARIOS);
const protectedMissing = falseGreen.find(
  (scenario) => scenario.id === 'protected-current-head-unavailable',
);
assert.ok(protectedMissing);
protectedMissing.expected.qualityGreen = true;
const falseGreenReport = evaluateRepresentativeScenarios(falseGreen);
assert.equal(falseGreenReport.ok, false);
assert.ok(
  falseGreenReport.results
    .find((result) => result.id === 'protected-current-head-unavailable')
    ?.problems.some((problem) => problem.includes('quality_green false != expected true')),
);

console.log('ZEUS adaptive representative eval regressions: PASS');
