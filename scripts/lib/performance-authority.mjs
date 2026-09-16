import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '../..');
export const authorityPath = path.join(repoRoot, 'benchmarks/PERFORMANCE-BUDGETS.json');
export const fixtureManifestPath = path.join(repoRoot, 'benchmarks/fixtures/core-workflow-v1.json');

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function readPerformanceAuthority() {
  return readJson(authorityPath);
}

export function readFixtureManifest() {
  return readJson(fixtureManifestPath);
}

export function getWorkflow(authority, workflowId) {
  const workflow = authority.workflows.find((entry) => entry.id === workflowId);
  if (!workflow) throw new Error(`Unknown performance workflow: ${workflowId}`);
  return workflow;
}

export function getStartupBundleBudget(authority) {
  const startup = authority.bundle?.startup;
  if (!startup || startup.status !== 'accepted' || !Number.isFinite(startup.threshold)) {
    throw new Error('Canonical startup bundle budget is absent or not accepted.');
  }
  return startup;
}

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

export function percentile(values, percentileValue) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1);
  return sorted[index];
}

export function coefficientOfVariation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export function aggregateSamples(values) {
  return {
    sampleCount: values.length,
    median: median(values),
    p95: percentile(values, 0.95),
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    coefficientOfVariation: coefficientOfVariation(values),
  };
}

const DIAGNOSTIC_TOP_LEVEL_KEYS = new Set([
  'schemaVersion',
  'workflowId',
  'subsystem',
  'fixtureId',
  'repositorySha',
  'coldOrWarm',
  'environment',
  'samples',
  'aggregates',
  'counters',
  'bottleneckClasses',
]);
const ENVIRONMENT_KEYS = new Set([
  'browser',
  'engine',
  'os',
  'cpuModel',
  'logicalCpuCount',
  'runner',
  'deviceClass',
  'gpuClass',
  'memoryGiB',
  'nodeVersion',
]);
const BOTTLENECK_CLASSES = new Set([
  'main-thread',
  'worker',
  'io',
  'network',
  'rendering',
  'bundle',
  'deferred-chunk',
  'startup-main-thread',
  'startup-rendering',
  'compositing',
  'backdrop-filter',
  'frame-time',
]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/+() @-]{0,159}$/;
const METRIC_KEY = /^[A-Za-z][A-Za-z0-9._-]{0,79}$/;

function assertIdentifier(value, location, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (typeof value !== 'string' || !IDENTIFIER.test(value) || /[\\\n\r]|\.arq\b/i.test(value)) {
    throw new Error(`${location} must be a bounded non-project identifier.`);
  }
}

function assertMetricObject(value, location, { nested = true } = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${location} must be an object.`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (!METRIC_KEY.test(key)) throw new Error(`${location} contains invalid metric key "${key}".`);
    if (child === null || typeof child === 'boolean') continue;
    if (typeof child === 'number' && Number.isFinite(child)) continue;
    if (nested && typeof child === 'object' && !Array.isArray(child)) {
      assertMetricObject(child, `${location}.${key}`, { nested });
      continue;
    }
    throw new Error(`${location}.${key} must contain numeric/boolean/null diagnostic data only.`);
  }
}

export function assertPrivacySafeDiagnostic(record) {
  if (record === null || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('diagnostic must be an object.');
  }
  for (const key of Object.keys(record)) {
    if (!DIAGNOSTIC_TOP_LEVEL_KEYS.has(key))
      throw new Error(`diagnostic contains unsupported field "${key}".`);
  }
  for (const key of DIAGNOSTIC_TOP_LEVEL_KEYS) {
    if (!Object.hasOwn(record, key))
      throw new Error(`diagnostic is missing required field "${key}".`);
  }
  if (record.schemaVersion !== 1) throw new Error('diagnostic schemaVersion must be 1.');
  assertIdentifier(record.workflowId, 'diagnostic.workflowId');
  assertIdentifier(record.subsystem, 'diagnostic.subsystem');
  assertIdentifier(record.fixtureId, 'diagnostic.fixtureId', { nullable: true });
  assertIdentifier(record.repositorySha, 'diagnostic.repositorySha');
  assertIdentifier(record.coldOrWarm, 'diagnostic.coldOrWarm');

  if (
    record.environment === null ||
    typeof record.environment !== 'object' ||
    Array.isArray(record.environment)
  ) {
    throw new Error('diagnostic.environment must be an object.');
  }
  for (const [key, value] of Object.entries(record.environment)) {
    if (!ENVIRONMENT_KEYS.has(key))
      throw new Error(`diagnostic.environment contains unsupported field "${key}".`);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error(`diagnostic.environment.${key} must be finite.`);
    } else {
      assertIdentifier(value, `diagnostic.environment.${key}`);
    }
  }

  if (!Array.isArray(record.samples)) throw new Error('diagnostic.samples must be an array.');
  record.samples.forEach((sample, index) =>
    assertMetricObject(sample, `diagnostic.samples[${index}]`, { nested: false }),
  );
  assertMetricObject(record.aggregates, 'diagnostic.aggregates');
  assertMetricObject(record.counters, 'diagnostic.counters', { nested: false });

  if (!Array.isArray(record.bottleneckClasses))
    throw new Error('diagnostic.bottleneckClasses must be an array.');
  for (const bottleneck of record.bottleneckClasses) {
    if (!BOTTLENECK_CLASSES.has(bottleneck))
      throw new Error(`unsupported bottleneck class "${bottleneck}".`);
  }
}

export function buildDiagnosticRecord(input) {
  const record = {
    schemaVersion: 1,
    workflowId: input.workflowId,
    subsystem: input.subsystem,
    fixtureId: input.fixtureId ?? null,
    repositorySha: input.repositorySha,
    coldOrWarm: input.coldOrWarm,
    environment: input.environment,
    samples: input.samples,
    aggregates: input.aggregates,
    counters: input.counters ?? {},
    bottleneckClasses: input.bottleneckClasses ?? [],
  };
  assertPrivacySafeDiagnostic(record);
  return record;
}
