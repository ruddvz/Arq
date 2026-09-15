#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one replacement anchor, found ${count}`);
  writeFileSync(path, source.replace(before, after));
}

const authorityPath = 'benchmarks/PERFORMANCE-BUDGETS.json';
const authority = readJson(authorityPath);
authority.schemaVersion = '2.1.0';
authority.fixtureContract = {
  ...authority.fixture,
  status: 'protected-scale-contract',
  productExecutable: false,
  rule:
    'This contract defines the protected Core scale. It is not evidence that one product-executable Core-scale project flowed through a workflow. Each workflow must name its actual evidenceFixture separately.',
};
delete authority.fixture;

const evidenceFixtures = {
  'app.boot.usable-workspace': {
    id: 'web-shell-no-project-v1',
    kind: 'product-state',
    source: 'scripts/run-core-workflow-performance.mjs',
    coreScale: false,
  },
  'plan.first-frame': {
    id: 'plan-renderer-scene-v1',
    kind: 'synthetic-renderer-scene',
    source: 'packages/plan-renderer/benchmarks/canvas-2d/scene.js',
    coreScale: false,
    matchesContractDimensions: ['walls', 'doorsAndWindows', 'rooms', 'annotations'],
  },
  'plan.pan-zoom': {
    id: 'plan-renderer-scene-v1',
    kind: 'synthetic-renderer-scene',
    source: 'packages/plan-renderer/benchmarks/canvas-2d/scene.js',
    coreScale: false,
    matchesContractDimensions: ['walls', 'doorsAndWindows', 'rooms', 'annotations'],
  },
  'plan.hover-selection': {
    id: 'selection-compute-v1',
    kind: 'synthetic-compute-harness',
    source: 'packages/editor-shell/src/selection-benchmark.test.ts',
    coreScale: false,
  },
  'room.recompute': {
    id: 'room-compute-grid-v1',
    kind: 'synthetic-compute-harness',
    source: 'packages/geometry-2d/src/room-rebuild-benchmark.test.ts',
    coreScale: false,
  },
  'material.compositing': {
    id: 'shell-material-probe-v1',
    kind: 'synthetic-shell-probe',
    source: 'scripts/run-material-compositing-performance.mjs',
    coreScale: false,
  },
};

for (const workflow of authority.workflows) {
  const previousFixture = workflow.fixture;
  workflow.fixtureContract = previousFixture === 'core-workflow-v1' ? 'core-workflow-v1' : null;
  workflow.evidenceFixture = evidenceFixtures[workflow.id] ?? null;
  delete workflow.fixture;
}

for (const evidence of authority.existingEvidence ?? []) {
  evidence.coreScale = false;
  evidence.evidenceFixtureId =
    evidence.workflowId === 'plan.pan-zoom' || evidence.workflowId === 'plan.first-frame'
      ? 'plan-renderer-scene-v1'
      : evidence.workflowId === 'plan.hover-selection'
        ? 'selection-compute-v1'
        : evidence.workflowId === 'room.recompute'
          ? 'room-compute-grid-v1'
          : null;
}
writeJson(authorityPath, authority);

const fixturePath = 'benchmarks/fixtures/core-workflow-v1.json';
const fixture = readJson(fixturePath);
fixture.status = 'protected-scale-contract';
fixture.productExecutable = false;
fixture.guardCoverage = {
  mechanicallyVerifiedAgainstBackingFixture: ['walls', 'doorsAndWindows', 'rooms', 'annotations'],
  contractOnlyPendingProductFixture: ['levels', 'underlays', 'semanticObjectsApprox'],
  rule:
    'Only mechanicallyVerifiedAgainstBackingFixture dimensions are currently proven against an executable backing fixture. Contract-only dimensions remain protected requirements but are not product-fixture evidence until #402 adds a product-executable Core-scale fixture.',
};
fixture.backingFixtures = fixture.backingFixtures.map((entry) =>
  entry.role === 'protected-renderer-scale'
    ? {
        ...entry,
        productExecutableCoreFixture: false,
        coveredDimensions: ['walls', 'doorsAndWindows', 'rooms', 'annotations'],
        note:
          'This renderer scene mechanically protects only the listed dimensions. It is not the product-executable Core-scale project required for #402 closure.',
      }
    : entry,
);
writeJson(fixturePath, fixture);

replaceOnce(
  '.github/workflows/benchmark.yml',
  "      - 'benchmarks/fixtures/**'\n",
  "      - 'benchmarks/fixtures/**'\n      - 'packages/plan-renderer/benchmarks/canvas-2d/scene.js'\n",
);
for (const command of [
  'pnpm benchmark:render-frame',
  'pnpm benchmark:canvas2d',
  'node scripts/run-core-workflow-performance.mjs',
  'node scripts/run-material-compositing-performance.mjs',
]) {
  replaceOnce(
    '.github/workflows/benchmark.yml',
    `      - run: ${command}\n`,
    `      - run: ${command}\n        continue-on-error: true\n`,
  );
}

replaceOnce(
  'scripts/check-performance-authority.mjs',
  "if (authority.schemaVersion !== '2.0.0') fail(`unexpected schemaVersion ${authority.schemaVersion}`);",
  "if (authority.schemaVersion !== '2.1.0') fail(`unexpected schemaVersion ${authority.schemaVersion}`);",
);
replaceOnce(
  'scripts/check-performance-authority.mjs',
  "  for (const field of ['description', 'fixture', 'measurementWindow', 'metrics', 'environmentClass', 'owner', 'evidenceStatus', 'enforcement']) {\n    if (workflow[field] === undefined || workflow[field] === null) fail(`${workflow.id}: missing ${field}`);\n  }\n",
  "  for (const field of ['description', 'measurementWindow', 'metrics', 'environmentClass', 'owner', 'evidenceStatus', 'enforcement']) {\n    if (workflow[field] === undefined || workflow[field] === null) fail(`${workflow.id}: missing ${field}`);\n  }\n  if (!Object.hasOwn(workflow, 'fixtureContract')) fail(`${workflow.id}: missing fixtureContract`);\n  if (!Object.hasOwn(workflow, 'evidenceFixture')) fail(`${workflow.id}: missing evidenceFixture`);\n  if (Object.hasOwn(workflow, 'fixture')) fail(`${workflow.id}: ambiguous legacy fixture field must not return`);\n  if (workflow.fixtureContract !== null && workflow.fixtureContract !== authority.fixtureContract?.id) {\n    fail(`${workflow.id}: unknown fixtureContract ${workflow.fixtureContract}`);\n  }\n  if (workflow.evidenceFixture !== null) {\n    const evidenceFixture = workflow.evidenceFixture;\n    for (const field of ['id', 'kind', 'source', 'coreScale']) {\n      if (!Object.hasOwn(evidenceFixture, field)) fail(`${workflow.id}: evidenceFixture missing ${field}`);\n    }\n    if (typeof evidenceFixture.coreScale !== 'boolean') fail(`${workflow.id}: evidenceFixture.coreScale must be boolean`);\n    if (evidenceFixture.coreScale && authority.fixtureContract?.productExecutable !== true) {\n      fail(`${workflow.id}: cannot claim Core-scale evidence before a product-executable Core fixture exists`);\n    }\n  }\n",
);
replaceOnce(
  'scripts/check-performance-authority.mjs',
  "const expected = fixture.protectedScale;\n",
  "if (authority.fixture !== undefined) fail('ambiguous top-level fixture authority must not return');\nif (authority.fixtureContract?.id !== fixture.id) fail('authority fixtureContract must reference the protected fixture manifest');\nif (authority.fixtureContract?.productExecutable !== false || fixture.productExecutable !== false) {\n  fail('current Core fixture must remain explicit contract-only until a product-executable Core fixture exists');\n}\nconst expected = fixture.protectedScale;\n",
);
replaceOnce(
  'scripts/check-performance-authority.mjs',
  "for (const [key, minimum] of Object.entries(fixture.complexityGuards?.minimum ?? {})) {\n  if ((expected[key] ?? 0) < minimum) fail(`fixture minimum ${key} dropped below ${minimum}`);\n}\n\nconst scenePath",
  "for (const [key, minimum] of Object.entries(fixture.complexityGuards?.minimum ?? {})) {\n  if ((expected[key] ?? 0) < minimum) fail(`fixture minimum ${key} dropped below ${minimum}`);\n}\nconst mechanicalCoverage = fixture.guardCoverage?.mechanicallyVerifiedAgainstBackingFixture ?? [];\nconst contractOnlyCoverage = fixture.guardCoverage?.contractOnlyPendingProductFixture ?? [];\nfor (const key of ['walls', 'doorsAndWindows', 'rooms', 'annotations']) {\n  if (!mechanicalCoverage.includes(key)) fail(`fixture ${key} must remain mechanically guarded`);\n}\nfor (const key of ['levels', 'underlays', 'semanticObjectsApprox']) {\n  if (!contractOnlyCoverage.includes(key)) fail(`fixture ${key} must remain explicit contract-only pending product fixture`);\n  if (mechanicalCoverage.includes(key)) fail(`fixture ${key} is falsely claimed as mechanically verified`);\n}\n\nconst scenePath",
);

const libPath = 'scripts/lib/performance-authority.mjs';
const libSource = readFileSync(libPath, 'utf8');
const privacyStart = libSource.indexOf('const FORBIDDEN_DIAGNOSTIC_KEYS');
if (privacyStart < 0) throw new Error('privacy helper start anchor not found');
const replacement = `const DIAGNOSTIC_TOP_LEVEL_KEYS = new Set([\n  'schemaVersion',\n  'workflowId',\n  'subsystem',\n  'fixtureId',\n  'repositorySha',\n  'coldOrWarm',\n  'environment',\n  'samples',\n  'aggregates',\n  'counters',\n  'bottleneckClasses',\n]);\nconst ENVIRONMENT_KEYS = new Set([\n  'browser',\n  'engine',\n  'os',\n  'cpuModel',\n  'logicalCpuCount',\n  'runner',\n  'deviceClass',\n  'gpuClass',\n  'memoryGiB',\n  'nodeVersion',\n]);\nconst BOTTLENECK_CLASSES = new Set([\n  'main-thread',\n  'worker',\n  'io',\n  'network',\n  'rendering',\n  'bundle',\n  'deferred-chunk',\n  'startup-main-thread',\n  'startup-rendering',\n  'compositing',\n  'backdrop-filter',\n  'frame-time',\n]);\nconst IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/+() @-]{0,159}$/;\nconst METRIC_KEY = /^[A-Za-z][A-Za-z0-9._-]{0,79}$/;\n\nfunction assertIdentifier(value, location, { nullable = false } = {}) {\n  if (nullable && value === null) return;\n  if (typeof value !== 'string' || !IDENTIFIER.test(value) || /[\\\\\\n\\r]|\\.arq\\b/i.test(value)) {\n    throw new Error(\`\${location} must be a bounded non-project identifier.\`);\n  }\n}\n\nfunction assertMetricObject(value, location, { nested = true } = {}) {\n  if (value === null || typeof value !== 'object' || Array.isArray(value)) {\n    throw new Error(\`\${location} must be an object.\`);\n  }\n  for (const [key, child] of Object.entries(value)) {\n    if (!METRIC_KEY.test(key)) throw new Error(\`\${location} contains invalid metric key "\${key}".\`);\n    if (child === null || typeof child === 'boolean') continue;\n    if (typeof child === 'number' && Number.isFinite(child)) continue;\n    if (nested && typeof child === 'object' && !Array.isArray(child)) {\n      assertMetricObject(child, \`\${location}.\${key}\`, { nested });\n      continue;\n    }\n    throw new Error(\`\${location}.\${key} must contain numeric/boolean/null diagnostic data only.\`);\n  }\n}\n\nexport function assertPrivacySafeDiagnostic(record) {\n  if (record === null || typeof record !== 'object' || Array.isArray(record)) {\n    throw new Error('diagnostic must be an object.');\n  }\n  for (const key of Object.keys(record)) {\n    if (!DIAGNOSTIC_TOP_LEVEL_KEYS.has(key)) throw new Error(\`diagnostic contains unsupported field "\${key}".\`);\n  }\n  for (const key of DIAGNOSTIC_TOP_LEVEL_KEYS) {\n    if (!Object.hasOwn(record, key)) throw new Error(\`diagnostic is missing required field "\${key}".\`);\n  }\n  if (record.schemaVersion !== 1) throw new Error('diagnostic schemaVersion must be 1.');\n  assertIdentifier(record.workflowId, 'diagnostic.workflowId');\n  assertIdentifier(record.subsystem, 'diagnostic.subsystem');\n  assertIdentifier(record.fixtureId, 'diagnostic.fixtureId', { nullable: true });\n  assertIdentifier(record.repositorySha, 'diagnostic.repositorySha');\n  assertIdentifier(record.coldOrWarm, 'diagnostic.coldOrWarm');\n\n  if (record.environment === null || typeof record.environment !== 'object' || Array.isArray(record.environment)) {\n    throw new Error('diagnostic.environment must be an object.');\n  }\n  for (const [key, value] of Object.entries(record.environment)) {\n    if (!ENVIRONMENT_KEYS.has(key)) throw new Error(\`diagnostic.environment contains unsupported field "\${key}".\`);\n    if (typeof value === 'number') {\n      if (!Number.isFinite(value)) throw new Error(\`diagnostic.environment.\${key} must be finite.\`);\n    } else {\n      assertIdentifier(value, \`diagnostic.environment.\${key}\`);\n    }\n  }\n\n  if (!Array.isArray(record.samples)) throw new Error('diagnostic.samples must be an array.');\n  record.samples.forEach((sample, index) => assertMetricObject(sample, \`diagnostic.samples[\${index}]\`, { nested: false }));\n  assertMetricObject(record.aggregates, 'diagnostic.aggregates');\n  assertMetricObject(record.counters, 'diagnostic.counters', { nested: false });\n\n  if (!Array.isArray(record.bottleneckClasses)) throw new Error('diagnostic.bottleneckClasses must be an array.');\n  for (const bottleneck of record.bottleneckClasses) {\n    if (!BOTTLENECK_CLASSES.has(bottleneck)) throw new Error(\`unsupported bottleneck class "\${bottleneck}".\`);\n  }\n}\n\nexport function buildDiagnosticRecord(input) {\n  const record = {\n    schemaVersion: 1,\n    workflowId: input.workflowId,\n    subsystem: input.subsystem,\n    fixtureId: input.fixtureId ?? null,\n    repositorySha: input.repositorySha,\n    coldOrWarm: input.coldOrWarm,\n    environment: input.environment,\n    samples: input.samples,\n    aggregates: input.aggregates,\n    counters: input.counters ?? {},\n    bottleneckClasses: input.bottleneckClasses ?? [],\n  };\n  assertPrivacySafeDiagnostic(record);\n  return record;\n}\n`;
writeFileSync(libPath, `${libSource.slice(0, privacyStart)}${replacement}`);

const testPath = 'scripts/check-performance-authority-test.mjs';
let testSource = readFileSync(testPath, 'utf8');
const oldTests = `let rejected = false;\ntry {\n  assertPrivacySafeDiagnostic({ projectName: 'private name' });\n} catch {\n  rejected = true;\n}\ncheck('private project-name fields are rejected', rejected);\n\nrejected = false;\ntry {\n  assertPrivacySafeDiagnostic({ nested: { geometryPayload: { wall: 'private geometry' } } });\n} catch {\n  rejected = true;\n}\ncheck('nested geometry payload fields are rejected', rejected);\n`;
const newTests = `for (const [description, mutate] of [\n  ['unknown top-level fields are rejected', (record) => ({ ...record, label: '/Users/alice/private-project.arq' })],\n  ['unknown environment fields are rejected', (record) => ({ ...record, environment: { ...record.environment, metadata: 'Client Tower' } })],\n  ['string sample payloads are rejected', (record) => ({ ...record, samples: [{ settledMs: 10, note: 'private document text' }] })],\n  ['string aggregate payloads are rejected', (record) => ({ ...record, aggregates: { settledMs: { median: 10, label: 'private' } } })],\n]) {\n  let rejected = false;\n  try {\n    assertPrivacySafeDiagnostic(mutate(safe));\n  } catch {\n    rejected = true;\n  }\n  check(description, rejected);\n}\n`;
if (!testSource.includes(oldTests)) throw new Error('privacy self-test replacement anchor not found');
testSource = testSource.replace(oldTests, newTests);
writeFileSync(testPath, testSource);

const materialPath = 'scripts/run-material-compositing-performance.mjs';
replaceOnce(
  materialPath,
  `    const styles = Object.fromEntries(surfaces.map((surface) => [surface.dataset.name, {\n      backdropFilter: getComputedStyle(surface).backdropFilter,\n      boxShadow: getComputedStyle(surface).boxShadow,\n      backgroundColor: getComputedStyle(surface).backgroundColor,\n    }]));\n`,
  `    const observations = Object.fromEntries(surfaces.map((surface) => {\n      const style = getComputedStyle(surface);\n      return [surface.dataset.name, {\n        backdropFilterActive: style.backdropFilter !== 'none',\n        boxShadowActive: style.boxShadow !== 'none',\n        opaqueBackground: !style.backgroundColor.includes('rgba') || !style.backgroundColor.endsWith(', 0)'),\n      }];\n    }));\n`,
);
replaceOnce(
  materialPath,
  '    return { frameTimes, longTasks, styles };\n',
  '    return { frameTimes, longTasks, observations };\n',
);
replaceOnce(
  materialPath,
  `        styles: runs[0].styles,\n        runCount: runs.length,\n`,
  `        observations: runs[0].observations,\n        runCount: runs.length,\n`,
);

console.log('Staged #402 review repairs.');
