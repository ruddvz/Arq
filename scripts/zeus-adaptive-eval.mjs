#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  adviseExpansion,
  operationFingerprint,
  shouldReuseOperation,
} from './zeus-adaptive-budget.mjs';
import { runtimeReceipt } from './zeus-adaptive-runtime.mjs';

export const EVAL_SCHEMA = 'zeus-adaptive-eval/v2';
const MEASURED_METRICS = ['contextChars', 'sources', 'toolCalls'];

function source(target, contextChars, expectedDecisionValue, purpose, options = {}) {
  return {
    kind: 'source',
    target,
    purpose,
    budgetCategory: 'sources',
    expectedDecisionValue,
    usage: { sources: 1, contextChars },
    ...options,
  };
}

function tool(target, expectedDecisionValue, purpose, options = {}) {
  return {
    kind: 'tool',
    target,
    purpose,
    budgetCategory: 'toolCallsBeforeReevaluation',
    expectedDecisionValue,
    usage: { toolCalls: 1 },
    ...options,
  };
}

function browser(target, expectedDecisionValue, purpose, options = {}) {
  return {
    kind: 'browser',
    target,
    purpose,
    budgetCategory: 'browserInteractions',
    expectedDecisionValue,
    usage: { toolCalls: 1, browserInteractions: 1 },
    ...options,
  };
}

const protectedSource = (target, contextChars, purpose) =>
  source(target, contextChars, true, purpose, {
    protectedEvidence: true,
    protectedProof: true,
  });
const protectedTool = (target, purpose) => tool(target, true, purpose, { protectedProof: true });

export const REPRESENTATIVE_SCENARIOS = [
  {
    id: 'readme-typo-fast',
    tier: 'fast',
    class: 'fast-standard',
    description: 'README typo with one focused proving path.',
    operations: [
      source('README.md', 1200, true, 'locate requested text'),
      source('AGENTS.md', 900, true, 'load repository operating constraints'),
      source('docs/architecture', 1500, false, 'broad architecture context'),
      source('.zeus/ZEUS.md', 1700, false, 'full doctrine after compact routing is sufficient'),
      tool('find-readme-target', true, 'locate exact edit'),
      tool('inspect-readme-diff', true, 'verify edit scope'),
      tool('broad-code-search', false, 'search unrelated implementation code'),
      tool('second-broad-code-search', false, 'repeat unrelated search'),
      tool('focused-markdown-check', true, 'prove requested edit'),
      tool('full-repository-suite', false, 'unrelated verification beyond requested stop'),
    ],
  },
  {
    id: 'renderer-style-standard',
    tier: 'standard',
    class: 'fast-standard',
    description: 'Isolated renderer styling with bounded visual verification.',
    operations: [
      source('renderer/component.tsx', 3200, true, 'target component'),
      source('renderer/component.css', 2400, true, 'target styling'),
      source('design/tokens.ts', 2100, true, 'governed visual tokens'),
      source('renderer/component.test.tsx', 2500, true, 'focused acceptance coverage'),
      source('unrelated-renderer-a.tsx', 2800, false, 'unaffected renderer'),
      source('unrelated-renderer-b.tsx', 2600, false, 'second unaffected renderer'),
      source('full-design-spec.md', 2800, false, 'whole document when governed snippets suffice'),
      source('historical-visual-notes.md', 2400, false, 'superseded visual context'),
      tool('target-symbol-search', true, 'locate affected symbol'),
      tool('focused-style-edit', true, 'apply bounded mutation'),
      tool('focused-component-test', true, 'prove component behaviour'),
      tool('typecheck-package', true, 'prove typed boundary'),
      tool('repository-wide-symbol-search', false, 'repeat broad discovery after impact is known'),
      tool('unaffected-package-tests', false, 'unrelated package verification'),
      tool('second-unaffected-package-tests', false, 'repeat unrelated verification'),
      tool('full-monorepo-build-before-focused-proof', false, 'premature broad verification'),
      tool('repeat-focused-test-without-change', false, 'blind rerun without new evidence'),
      tool('unrelated-lint-sweep', false, 'unrelated verification'),
      browser('target-viewport-open', true, 'inspect changed visual surface'),
      browser('target-viewport-acceptance', true, 'confirm visual acceptance'),
      browser('unaffected-route-tour', false, 'browse unrelated routes'),
      browser('repeat-unaffected-route-tour', false, 'repeat unrelated browsing'),
    ],
  },
  {
    id: 'semantic-project-operation-standard',
    tier: 'standard',
    class: 'fast-standard',
    description: 'Semantic project operation with model-owner proof.',
    operations: [
      source('packages/operations/target.ts', 3600, true, 'operation implementation'),
      source('packages/bim-core/model.ts', 4200, true, 'semantic owner'),
      source('packages/operations/target.test.ts', 3100, true, 'focused operation tests'),
      source('docs/adr/semantic-owner.md', 2600, true, 'accepted ownership decision'),
      source('apps/marketing', 1800, false, 'unrelated application surface'),
      source('packages/icons', 1600, false, 'unrelated package'),
      source('historical-pack.md', 2300, false, 'lower-authority duplicate'),
      source(
        'full-product-blueprint.md',
        2800,
        false,
        'whole spec when exact owner sources suffice',
      ),
      tool('operation-symbol-search', true, 'locate operation'),
      tool('owner-boundary-search', true, 'confirm semantic owner'),
      tool('focused-operation-tests', true, 'prove operation'),
      tool('bim-core-tests', true, 'prove semantic boundary'),
      tool('package-typecheck', true, 'prove typing'),
      tool('duplicate-owner-search', false, 'repeat resolved ownership lookup'),
      tool('marketing-tests', false, 'unaffected package'),
      tool('icons-tests', false, 'unaffected package'),
      tool('full-browser-sweep', false, 'visual proof not required by impact'),
      tool('repeat-focused-test-without-change', false, 'blind rerun without new evidence'),
      tool('unaffected-build', false, 'unrelated build'),
      tool('second-broad-search', false, 'duplicate broad discovery'),
    ],
  },
  {
    id: 'arq-migration-deep-protected',
    tier: 'deep',
    class: 'protected-deep',
    requireIndependentReview: true,
    requireCurrentHeadProof: true,
    description: '.arq migration keeps every protected proving operation.',
    operations: [
      protectedSource('project-format/schema.ts', 5200, 'canonical format schema'),
      protectedSource('project-format/migrations.ts', 4800, 'migration implementation'),
      protectedSource('project-loading/reader.ts', 4300, 'reader compatibility'),
      protectedSource('project-format/migration.test.ts', 5100, 'round-trip proof'),
      protectedTool('schema-validation', 'validate schema'),
      protectedTool('migration-fixtures', 'execute migrations'),
      protectedTool('round-trip-tests', 'prove persistence round trip'),
      protectedTool('package-tests', 'prove package boundary'),
      protectedTool('repository-tests', 'prove downstream compatibility'),
      protectedTool('current-head-proof', 'bind proof to current head'),
    ],
  },
  {
    id: 'geometry-unit-boundary-deep-protected',
    tier: 'deep',
    class: 'protected-deep',
    requireIndependentReview: true,
    requireCurrentHeadProof: true,
    description: 'Geometry/unit boundary keeps all current protected proof.',
    operations: [
      protectedSource('geometry-2d/target.ts', 4800, 'geometry implementation'),
      protectedSource('bim-core/units.ts', 4300, 'canonical unit semantics'),
      protectedSource('geometry-2d/target.test.ts', 4700, 'geometry regression coverage'),
      protectedTool('geometry-focused-tests', 'prove geometry result'),
      protectedTool('unit-boundary-tests', 'prove canonical units'),
      protectedTool('package-typecheck', 'prove typed boundary'),
      protectedTool('repository-tests', 'prove downstream use'),
      protectedTool('current-head-proof', 'bind proof to current head'),
    ],
  },
];

function addUsage(actual, delta = {}) {
  for (const [key, value] of Object.entries(delta)) {
    actual[key] = Number(actual[key] ?? 0) + Number(value ?? 0);
  }
}

function budgetUsed(actual, category) {
  const categoryToActual = {
    sources: 'sources',
    modules: 'modules',
    contextChars: 'contextChars',
    supportingMethods: 'supportingMethods',
    toolCallsBeforeReevaluation: 'toolCalls',
    externalResearchQueries: 'externalResearchQueries',
    browserInteractions: 'browserInteractions',
    parallelReadOnlyAgents: 'readOnlyAgents',
    parallelMutationLanes: 'mutationLanes',
    repairRounds: 'repairRounds',
    reviewerFanoutSoftCeiling: 'reviewers',
  };
  return Number(actual[categoryToActual[category]] ?? 0);
}

function runFixedTierBaseline(scenario) {
  const actual = {};
  for (const operation of scenario.operations) addUsage(actual, operation.usage);
  return actual;
}

function runAdaptivePolicy(scenario) {
  const actual = {};
  const seen = new Set();
  let duplicateOperationsSuppressed = 0;

  for (const operation of scenario.operations) {
    const key = operationFingerprint({
      kind: operation.kind,
      target: operation.target,
      sourceFingerprint: 'representative-eval-v2',
      purpose: operation.purpose,
    });
    const reuse = shouldReuseOperation({
      seen,
      key,
      protectedEvidence: operation.protectedEvidence === true,
      stateChanged: false,
    });
    if (reuse.reuse) {
      duplicateOperationsSuppressed += 1;
      continue;
    }

    const advice = adviseExpansion({
      tier: scenario.tier,
      category: operation.budgetCategory,
      used: budgetUsed(actual, operation.budgetCategory),
      expectedDecisionValue: operation.expectedDecisionValue === true,
      protectedProof: operation.protectedProof === true,
    });
    if (!advice.allowed) continue;

    addUsage(actual, operation.usage);
    seen.add(key);
  }

  return {
    ...actual,
    duplicateOperationsSuppressed,
    duplicateOperationsExecuted: 0,
  };
}

function verificationFor(scenario) {
  return {
    'required-gates': 'passed',
    ...(scenario.requireIndependentReview ? { 'required-independent-review': 'passed' } : {}),
    ...(scenario.requireCurrentHeadProof ? { 'current-head-proof': 'passed' } : {}),
  };
}

function receiptFor(scenario, actual) {
  return runtimeReceipt({
    phase: 'finish',
    tier: scenario.tier,
    usage: actual,
    verification: verificationFor(scenario),
    acceptanceProven: true,
    requireIndependentReview: scenario.requireIndependentReview === true,
    requireCurrentHeadProof: scenario.requireCurrentHeadProof === true,
  });
}

function reduction(baseline, adaptive, metric) {
  const before = Number(baseline[metric] ?? 0);
  const after = Number(adaptive[metric] ?? 0);
  return before === 0 ? 0 : (before - after) / before;
}

function receiptIsGreen(receipt) {
  return (
    receipt.decision === 'stop-success' &&
    receipt.quality_green === true &&
    receipt.within_budget === true &&
    Object.values(receipt.verification).every((state) => state === 'passed')
  );
}

export function evaluateScenario(scenario) {
  const baseline = runFixedTierBaseline(scenario);
  const adaptive = runAdaptivePolicy(scenario);
  const baselineReceipt = receiptFor(scenario, baseline);
  const adaptiveReceipt = receiptFor(scenario, adaptive);

  return {
    id: scenario.id,
    tier: scenario.tier,
    class: scenario.class,
    description: scenario.description,
    baseline_policy: 'fixed-tier candidate consumption',
    adaptive_policy: 'value-of-information plus fingerprint-valid reuse',
    baseline,
    adaptive,
    reduction: Object.fromEntries(
      MEASURED_METRICS.map((metric) => [metric, reduction(baseline, adaptive, metric)]),
    ),
    baseline_quality_green: receiptIsGreen(baselineReceipt),
    adaptive_quality_green: receiptIsGreen(adaptiveReceipt),
    baseline_decision: baselineReceipt.decision,
    adaptive_decision: adaptiveReceipt.decision,
    verification_frontier: adaptiveReceipt.verification_frontier,
  };
}

function average(results, key, metric) {
  return (
    results.reduce((sum, result) => sum + Number(result[key][metric] ?? 0), 0) / results.length
  );
}

export function evaluateRepresentativeScenarios(scenarios = REPRESENTATIVE_SCENARIOS) {
  const results = scenarios.map(evaluateScenario);
  const fastStandard = results.filter((result) => result.class === 'fast-standard');
  const protectedDeep = results.filter((result) => result.class === 'protected-deep');

  const averages = Object.fromEntries(
    MEASURED_METRICS.map((metric) => {
      const baseline = average(fastStandard, 'baseline', metric);
      const adaptive = average(fastStandard, 'adaptive', metric);
      return [
        metric,
        {
          baseline,
          adaptive,
          reduction: baseline === 0 ? 0 : (baseline - adaptive) / baseline,
        },
      ];
    }),
  );

  const assertions = [
    {
      id: 'fast-standard-average-context-source-tool-consumption-is-lower',
      pass: MEASURED_METRICS.every(
        (metric) => averages[metric].adaptive < averages[metric].baseline,
      ),
    },
    {
      id: 'gate-correctness-is-preserved',
      pass: results.every(
        (result) => result.baseline_quality_green && result.adaptive_quality_green,
      ),
    },
    {
      id: 'deep-protected-work-is-not-pruned',
      pass: protectedDeep.every((result) =>
        MEASURED_METRICS.every(
          (metric) => Number(result.adaptive[metric] ?? 0) === Number(result.baseline[metric] ?? 0),
        ),
      ),
    },
    {
      id: 'deep-protected-frontier-keeps-review-and-current-head-proof',
      pass: protectedDeep.every(
        (result) =>
          result.verification_frontier.includes('required-independent-review') &&
          result.verification_frontier.includes('current-head-proof'),
      ),
    },
  ];

  return {
    schema: EVAL_SCHEMA,
    methodology:
      'Controlled representative workloads hold acceptance and verification constant. The fixed-tier baseline consumes every candidate operation inside the same tier. The adaptive run applies the current value-of-information and reuse policy. Protected deep operations are current-proof work and must not be pruned.',
    results,
    fast_standard_average: averages,
    assertions,
    ok: assertions.every((assertion) => assertion.pass),
  };
}

function human(report) {
  const lines = [`ZEUS adaptive representative eval: ${report.ok ? 'PASS' : 'FAIL'}`];
  for (const metric of MEASURED_METRICS) {
    const values = report.fast_standard_average[metric];
    lines.push(
      `${metric}: ${values.baseline.toFixed(1)} -> ${values.adaptive.toFixed(1)} (${(
        values.reduction * 100
      ).toFixed(1)}% lower)`,
    );
  }
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
