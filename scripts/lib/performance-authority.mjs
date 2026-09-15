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

const FORBIDDEN_DIAGNOSTIC_KEYS = new Set([
  'projectName',
  'projectPath',
  'documentText',
  'geometryPayload',
  'userContent',
  'fileContents',
  'selectionText',
]);

export function assertPrivacySafeDiagnostic(value, location = 'diagnostic') {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPrivacySafeDiagnostic(entry, `${location}[${index}]`));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_DIAGNOSTIC_KEYS.has(key)) {
      throw new Error(`${location} contains forbidden private-content key "${key}".`);
    }
    assertPrivacySafeDiagnostic(child, `${location}.${key}`);
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
