#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compile } from './lib/zeus-engine.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const contextScript = path.join(repoRoot, 'scripts', 'zeus-context.mjs');
const adaptivePolicy = JSON.parse(
  readFileSync(path.join(repoRoot, '.zeus', 'adaptive-cto.json'), 'utf8'),
);
const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'zeus-adaptive-quality-'));
const cache = path.join(tempRoot, 'project-index.json');

function context(query, tier, adaptive = false) {
  const args = [
    contextScript,
    '--root',
    repoRoot,
    '--cache',
    cache,
    '--query',
    query,
    '--tier',
    tier,
    '--snippets',
  ];
  if (adaptive) args.push('--adaptive');
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function expectSubset(actual, expected, label) {
  for (const [key, value] of Object.entries(expected)) {
    assert.deepEqual(actual[key], value, `${label}: expected ${key}=${JSON.stringify(value)}`);
  }
}

function measure(name, query, tier) {
  const ranked = context(query, tier, false);
  const adaptive = context(query, tier, true);
  return {
    name,
    tier,
    query,
    ranked,
    adaptive,
    metrics: {
      rankedSourceReads: ranked.results.length,
      adaptiveSourceReads: adaptive.results.length,
      rankedContextChars: ranked.usedContextChars,
      adaptiveContextChars: adaptive.usedContextChars,
      sourceCeiling: adaptive.budget.sources,
      contextCharCeiling: adaptive.budget.contextChars,
      contextRetrievalOperations: 1,
      toolCallsBeforeReevaluation:
        adaptivePolicy.budgetExtensions[tier].toolCallsBeforeReevaluation,
    },
  };
}

try {
  const routes = {
    fast: compile('Fix a README typo and stop after local implementation'),
    standard: compile(
      'Improve editor hover affordance for wall selection and stop after local implementation',
    ),
    deepArq: compile(
      'Fix .arq project format recovery migration and stop after local implementation',
    ),
    deepGeometry: compile(
      'Fix wall geometry topology constraints and stop after local implementation',
    ),
  };

  expectSubset(
    routes.fast,
    {
      mode: 'implement',
      risk: 'low',
      tier: 'fast',
      deliveryStop: 'local-green',
      blastRadius: 'local',
    },
    'fast routing',
  );
  assert.equal(routes.fast.modules.length, 0, 'fast docs task should not fan out to a module');

  expectSubset(
    routes.standard,
    {
      mode: 'implement',
      risk: 'moderate',
      tier: 'standard',
      deliveryStop: 'local-green',
      blastRadius: 'product',
    },
    'standard routing',
  );
  for (const module of ['editor-input', 'geometry', 'ui-visual']) {
    assert(routes.standard.modules.includes(module), `standard routing should retain ${module}`);
  }

  expectSubset(
    routes.deepArq,
    {
      mode: 'implement',
      risk: 'high',
      tier: 'deep',
      deliveryStop: 'local-green',
      blastRadius: 'persistent',
      cachePolicy: 'no critical gate cache',
    },
    'deep .arq routing',
  );
  assert(routes.deepArq.modules.includes('arqfs'), 'deep .arq routing should retain arqfs');
  for (const reviewer of ['qa-release', 'security']) {
    assert(
      routes.deepArq.reviewers.includes(reviewer),
      `deep .arq routing should retain ${reviewer}`,
    );
  }

  expectSubset(
    routes.deepGeometry,
    {
      mode: 'implement',
      risk: 'high',
      tier: 'deep',
      deliveryStop: 'local-green',
      blastRadius: 'product',
      cachePolicy: 'no critical gate cache',
    },
    'deep geometry routing',
  );
  assert(
    routes.deepGeometry.modules.includes('geometry'),
    'deep geometry routing should retain geometry',
  );

  const fast = measure('fast-readme', 'README typo documentation', 'fast');
  const standard = measure(
    'standard-editor',
    'editor wall selection hover affordance',
    'standard',
  );
  const deep = measure('deep-arq', 'arq project format recovery migration', 'deep');

  for (const sample of [fast, standard]) {
    assert.equal(sample.adaptive.selection.policy, 'query-coverage-plus-source-test-pair');
    assert(
      sample.metrics.adaptiveSourceReads < sample.metrics.rankedSourceReads,
      `${sample.name}: adaptive source reads must be lower than ranked retrieval`,
    );
    assert(
      sample.metrics.adaptiveContextChars < sample.metrics.rankedContextChars,
      `${sample.name}: adaptive context chars must be lower than ranked retrieval`,
    );
    assert(
      sample.metrics.contextRetrievalOperations < sample.metrics.toolCallsBeforeReevaluation,
      `${sample.name}: representative retrieval must stay below reevaluation guard`,
    );
  }

  assert.equal(deep.adaptive.selection.policy, 'deep-retains-ranked-ceiling');
  assert.equal(deep.metrics.adaptiveSourceReads, deep.metrics.rankedSourceReads);
  assert.equal(deep.metrics.adaptiveContextChars, deep.metrics.rankedContextChars);
  assert.deepEqual(
    deep.adaptive.results.map((item) => item.path),
    deep.ranked.results.map((item) => item.path),
    'deep adaptive retrieval must retain the ranked protected source set',
  );

  const cheap = [fast, standard];
  const totals = cheap.reduce(
    (sum, sample) => ({
      rankedSourceReads: sum.rankedSourceReads + sample.metrics.rankedSourceReads,
      adaptiveSourceReads: sum.adaptiveSourceReads + sample.metrics.adaptiveSourceReads,
      rankedContextChars: sum.rankedContextChars + sample.metrics.rankedContextChars,
      adaptiveContextChars: sum.adaptiveContextChars + sample.metrics.adaptiveContextChars,
    }),
    {
      rankedSourceReads: 0,
      adaptiveSourceReads: 0,
      rankedContextChars: 0,
      adaptiveContextChars: 0,
    },
  );

  const report = {
    schemaVersion: 1,
    claim:
      'Deterministic representative current-repository evaluation; not historical production telemetry.',
    correctness: {
      fast: {
        mode: routes.fast.mode,
        risk: routes.fast.risk,
        tier: routes.fast.tier,
        deliveryStop: routes.fast.deliveryStop,
        blastRadius: routes.fast.blastRadius,
      },
      standard: {
        mode: routes.standard.mode,
        risk: routes.standard.risk,
        tier: routes.standard.tier,
        deliveryStop: routes.standard.deliveryStop,
        blastRadius: routes.standard.blastRadius,
        modules: routes.standard.modules,
      },
      deepArq: {
        risk: routes.deepArq.risk,
        tier: routes.deepArq.tier,
        blastRadius: routes.deepArq.blastRadius,
        cachePolicy: routes.deepArq.cachePolicy,
        reviewers: routes.deepArq.reviewers,
      },
      deepGeometry: {
        risk: routes.deepGeometry.risk,
        tier: routes.deepGeometry.tier,
        blastRadius: routes.deepGeometry.blastRadius,
        modules: routes.deepGeometry.modules,
        reviewers: routes.deepGeometry.reviewers,
      },
    },
    samples: [fast, standard, deep].map((sample) => ({
      name: sample.name,
      tier: sample.tier,
      query: sample.query,
      policy: sample.adaptive.selection.policy,
      stopReason: sample.adaptive.selection.stopReason,
      metrics: sample.metrics,
    })),
    fastStandardAverage: {
      rankedSourceReads: totals.rankedSourceReads / cheap.length,
      adaptiveSourceReads: totals.adaptiveSourceReads / cheap.length,
      sourceReadReductionFraction: 1 - totals.adaptiveSourceReads / totals.rankedSourceReads,
      rankedContextChars: totals.rankedContextChars / cheap.length,
      adaptiveContextChars: totals.adaptiveContextChars / cheap.length,
      contextCharReductionFraction: 1 - totals.adaptiveContextChars / totals.rankedContextChars,
    },
    deepProtected: {
      rankedSourceReads: deep.metrics.rankedSourceReads,
      adaptiveSourceReads: deep.metrics.adaptiveSourceReads,
      rankedContextChars: deep.metrics.rankedContextChars,
      adaptiveContextChars: deep.metrics.adaptiveContextChars,
      unchanged: true,
    },
  };

  console.log(JSON.stringify(report, null, 2));
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
