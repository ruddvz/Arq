#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runtimeReceipt } from './zeus-adaptive-runtime.mjs';

export const EVAL_SCHEMA = 'zeus-adaptive-eval/v1';

const greenVerification = ({ review = false, currentHead = false, ownerApproval = false } = {}) => ({
  'required-gates': 'passed',
  ...(review ? { 'required-independent-review': 'passed' } : {}),
  ...(ownerApproval ? { 'protected-owner-approval': 'passed' } : {}),
  ...(currentHead ? { 'current-head-proof': 'passed' } : {}),
});

const usage = (overrides = {}) => ({
  modules: 0,
  sources: 0,
  contextChars: 0,
  supportingMethods: 0,
  toolCalls: 0,
  externalResearchQueries: 0,
  browserInteractions: 0,
  readOnlyAgents: 0,
  mutationLanes: 0,
  repairRounds: 0,
  reviewers: 0,
  duplicateOperationsSuppressed: 0,
  duplicateOperationsExecuted: 0,
  ...overrides,
});

export const REPRESENTATIVE_SCENARIOS = [
  {
    id: 'readme-typo-fast',
    description: 'README typo uses a small fast-tier slice and one focused proof path.',
    class: 'fast-standard-success',
    tier: 'fast',
    input: {
      phase: 'finish',
      tier: 'fast',
      usage: usage({ modules: 1, sources: 1, contextChars: 1600, toolCalls: 2, mutationLanes: 1 }),
      verification: greenVerification(),
      acceptanceProven: true,
    },
    expected: { decision: 'stop-success', qualityGreen: true, withinBudget: true, tier: 'fast' },
  },
  {
    id: 'renderer-style-standard',
    description: 'Isolated renderer styling uses bounded context and visual verification only.',
    class: 'fast-standard-success',
    tier: 'standard',
    input: {
      phase: 'finish',
      tier: 'standard',
      usage: usage({
        modules: 2,
        sources: 3,
        contextChars: 7000,
        supportingMethods: 1,
        toolCalls: 6,
        browserInteractions: 2,
        mutationLanes: 1,
      }),
      verification: greenVerification(),
      acceptanceProven: true,
    },
    expected: {
      decision: 'stop-success',
      qualityGreen: true,
      withinBudget: true,
      tier: 'standard',
    },
  },
  {
    id: 'deep-subsystem-answer-only',
    description: 'Explanation-only work may reason deeply without mutation or ship-gate consumption.',
    class: 'fast-standard-success',
    tier: 'standard',
    input: {
      phase: 'finish',
      tier: 'standard',
      usage: usage({ modules: 2, sources: 2, contextChars: 6000, toolCalls: 4 }),
      verification: greenVerification(),
      acceptanceProven: true,
    },
    expected: {
      decision: 'stop-success',
      qualityGreen: true,
      withinBudget: true,
      tier: 'standard',
    },
  },
  {
    id: 'duplicate-source-reuse-fast',
    description: 'A fingerprint-valid repeated source is reused instead of re-read.',
    class: 'fast-standard-success',
    tier: 'fast',
    input: {
      phase: 'finish',
      tier: 'fast',
      usage: usage({
        modules: 1,
        sources: 1,
        contextChars: 1400,
        toolCalls: 2,
        duplicateOperationsSuppressed: 1,
      }),
      verification: greenVerification(),
      acceptanceProven: true,
    },
    expected: { decision: 'stop-success', qualityGreen: true, withinBudget: true, tier: 'fast' },
  },
  {
    id: 'arq-migration-deep-protected',
    description: '.arq migration remains deep and requires independent/current-head proof.',
    class: 'protected-success',
    tier: 'deep',
    input: {
      phase: 'finish',
      tier: 'deep',
      usage: usage({
        modules: 4,
        sources: 8,
        contextChars: 32000,
        supportingMethods: 2,
        toolCalls: 18,
        readOnlyAgents: 1,
        mutationLanes: 1,
        repairRounds: 1,
        reviewers: 1,
      }),
      verification: greenVerification({ review: true, currentHead: true }),
      acceptanceProven: true,
      requireIndependentReview: true,
      requireCurrentHeadProof: true,
    },
    expected: { decision: 'stop-success', qualityGreen: true, withinBudget: true, tier: 'deep' },
  },
  {
    id: 'geometry-unit-boundary-deep',
    description: 'Geometry/unit boundary work stays deep even with a bounded implementation surface.',
    class: 'protected-success',
    tier: 'deep',
    input: {
      phase: 'finish',
      tier: 'deep',
      usage: usage({
        modules: 4,
        sources: 7,
        contextChars: 30000,
        supportingMethods: 2,
        toolCalls: 16,
        mutationLanes: 1,
        reviewers: 1,
      }),
      verification: greenVerification({ review: true, currentHead: true }),
      acceptanceProven: true,
      requireIndependentReview: true,
      requireCurrentHeadProof: true,
    },
    expected: { decision: 'stop-success', qualityGreen: true, withinBudget: true, tier: 'deep' },
  },
  {
    id: 'ai-apply-undo-deep',
    description: 'AI apply/undo work retains deep proof and independent review.',
    class: 'protected-success',
    tier: 'deep',
    input: {
      phase: 'finish',
      tier: 'deep',
      usage: usage({
        modules: 5,
        sources: 8,
        contextChars: 35000,
        supportingMethods: 2,
        toolCalls: 19,
        mutationLanes: 1,
        repairRounds: 1,
        reviewers: 1,
      }),
      verification: greenVerification({ review: true, currentHead: true }),
      acceptanceProven: true,
      requireIndependentReview: true,
      requireCurrentHeadProof: true,
    },
    expected: { decision: 'stop-success', qualityGreen: true, withinBudget: true, tier: 'deep' },
  },
  {
    id: 'protected-current-head-unavailable',
    description: 'Protected work blocks when current-head proof is unavailable.',
    class: 'protected-fail-closed',
    tier: 'deep',
    input: {
      phase: 'finish',
      tier: 'deep',
      usage: usage({ modules: 3, sources: 6, contextChars: 22000, toolCalls: 12, reviewers: 1 }),
      verification: {
        'required-gates': 'passed',
        'required-independent-review': 'passed',
        'current-head-proof': 'not-executed',
      },
      acceptanceProven: false,
      requireIndependentReview: true,
      requireCurrentHeadProof: true,
    },
    expected: {
      decision: 'block-external-evidence',
      qualityGreen: false,
      withinBudget: true,
      tier: 'deep',
    },
  },
  {
    id: 'repeated-work-detected',
    description: 'Executed duplicate work cannot be reported as an efficient successful finish.',
    class: 'waste-detection',
    tier: 'standard',
    input: {
      phase: 'finish',
      tier: 'standard',
      usage: usage({
        modules: 2,
        sources: 3,
        contextChars: 8000,
        toolCalls: 7,
        duplicateOperationsExecuted: 1,
      }),
      verification: greenVerification(),
      acceptanceProven: true,
    },
    expected: {
      decision: 're-evaluate-tier-or-evidence-plan',
      qualityGreen: true,
      withinBudget: true,
      tier: 'standard',
    },
  },
];

const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

function utilization(receipt) {
  const fields = ['contextChars', 'sources', 'toolCalls'];
  return Object.fromEntries(
    fields.map((field) => {
      const limit = Number(receipt.limits[field] ?? 0);
      const actual = Number(receipt.actual[field] ?? 0);
      return [field, limit > 0 ? actual / limit : 0];
    }),
  );
}

function evaluateScenario(scenario) {
  const receipt = runtimeReceipt(scenario.input);
  const problems = [];
  if (receipt.tier !== scenario.expected.tier) {
    problems.push(`tier ${receipt.tier} != expected ${scenario.expected.tier}`);
  }
  if (receipt.decision !== scenario.expected.decision) {
    problems.push(`decision ${receipt.decision} != expected ${scenario.expected.decision}`);
  }
  if (receipt.quality_green !== scenario.expected.qualityGreen) {
    problems.push(
      `quality_green ${receipt.quality_green} != expected ${scenario.expected.qualityGreen}`,
    );
  }
  if (receipt.within_budget !== scenario.expected.withinBudget) {
    problems.push(
      `within_budget ${receipt.within_budget} != expected ${scenario.expected.withinBudget}`,
    );
  }
  return {
    id: scenario.id,
    description: scenario.description,
    class: scenario.class,
    tier: receipt.tier,
    decision: receipt.decision,
    quality_green: receipt.quality_green,
    within_budget: receipt.within_budget,
    efficient: receipt.efficient,
    duplicate_operations_suppressed: receipt.duplicate_operations_suppressed,
    duplicate_operations_executed: receipt.duplicate_operations_executed,
    verification_frontier: receipt.verification_frontier,
    utilization: utilization(receipt),
    pass: problems.length === 0,
    problems,
  };
}

export function evaluateRepresentativeScenarios(scenarios = REPRESENTATIVE_SCENARIOS) {
  const results = scenarios.map(evaluateScenario);
  const fastStandard = results.filter((result) => result.class === 'fast-standard-success');
  const fastStandardRatios = fastStandard.flatMap((result) => Object.values(result.utilization));
  const meanUtilization = average(fastStandardRatios);
  const maxUtilization = fastStandardRatios.length ? Math.max(...fastStandardRatios) : 0;
  const protectedSuccess = results.filter((result) => result.class === 'protected-success');
  const protectedFailClosed = results.filter(
    (result) => result.class === 'protected-fail-closed',
  );
  const wasteDetection = results.filter((result) => result.class === 'waste-detection');

  const assertions = [
    {
      id: 'representative-scenarios-match-expected-outcomes',
      pass: results.every((result) => result.pass),
    },
    {
      id: 'fast-standard-average-work-below-half-ceiling',
      pass: fastStandard.length > 0 && meanUtilization < 0.5 && maxUtilization <= 0.5,
    },
    {
      id: 'fast-standard-quality-remains-green',
      pass:
        fastStandard.length > 0 &&
        fastStandard.every(
          (result) => result.quality_green && result.within_budget && result.decision === 'stop-success',
        ),
    },
    {
      id: 'deep-protected-work-does-not-deescalate',
      pass:
        protectedSuccess.length > 0 &&
        protectedSuccess.every(
          (result) =>
            result.tier === 'deep' &&
            result.quality_green &&
            result.within_budget &&
            result.verification_frontier.includes('required-independent-review') &&
            result.verification_frontier.includes('current-head-proof'),
        ),
    },
    {
      id: 'protected-proof-unavailable-fails-closed',
      pass:
        protectedFailClosed.length > 0 &&
        protectedFailClosed.every(
          (result) =>
            !result.quality_green && result.decision === 'block-external-evidence' && result.tier === 'deep',
        ),
    },
    {
      id: 'duplicate-execution-is-detected',
      pass:
        wasteDetection.length > 0 &&
        wasteDetection.every(
          (result) =>
            result.duplicate_operations_executed > 0 &&
            result.decision === 're-evaluate-tier-or-evidence-plan' &&
            !result.efficient,
        ),
    },
  ];

  return {
    schema: EVAL_SCHEMA,
    results,
    summary: {
      scenarios: results.length,
      fast_standard: {
        scenarios: fastStandard.length,
        mean_utilization: Number(meanUtilization.toFixed(4)),
        max_utilization: Number(maxUtilization.toFixed(4)),
        savings_vs_full_ceiling: Number((1 - meanUtilization).toFixed(4)),
        quality_green_rate: Number(
          (average(fastStandard.map((result) => (result.quality_green ? 1 : 0))) || 0).toFixed(4),
        ),
      },
      protected: {
        successful_scenarios: protectedSuccess.length,
        quality_green_rate: Number(
          (average(protectedSuccess.map((result) => (result.quality_green ? 1 : 0))) || 0).toFixed(4),
        ),
        fail_closed_scenarios: protectedFailClosed.length,
        fail_closed_rate: Number(
          (average(
            protectedFailClosed.map((result) =>
              !result.quality_green && result.decision === 'block-external-evidence' ? 1 : 0,
            ),
          ) || 0).toFixed(4),
        ),
      },
    },
    assertions,
    ok: assertions.every((assertion) => assertion.pass),
  };
}

function human(report) {
  const lines = [
    `ZEUS adaptive representative eval: ${report.ok ? 'PASS' : 'FAIL'}`,
    `Scenarios: ${report.summary.scenarios}`,
    `Fast/standard mean ceiling use: ${(report.summary.fast_standard.mean_utilization * 100).toFixed(1)}%`,
    `Fast/standard saved vs full ceiling: ${(report.summary.fast_standard.savings_vs_full_ceiling * 100).toFixed(1)}%`,
    `Fast/standard quality-green rate: ${(report.summary.fast_standard.quality_green_rate * 100).toFixed(0)}%`,
    `Protected quality-green rate: ${(report.summary.protected.quality_green_rate * 100).toFixed(0)}%`,
    `Protected fail-closed rate: ${(report.summary.protected.fail_closed_rate * 100).toFixed(0)}%`,
  ];
  for (const assertion of report.assertions) {
    lines.push(`${assertion.pass ? 'PASS' : 'FAIL'} ${assertion.id}`);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const report = evaluateRepresentativeScenarios();
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else process.stdout.write(human(report));
  if (!report.ok) process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) main();
