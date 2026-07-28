#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyChange } from './classify-change.mjs';
import { evaluateEvidence } from './verify-evidence.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '../..');
const map = JSON.parse(fs.readFileSync(path.join(root, 'ops/change-map.v5.json'), 'utf8'));
const catalog = JSON.parse(
  fs.readFileSync(path.join(root, 'ops/evidence-catalog.v5.json'), 'utf8'),
);

function fixtureFiles(directory) {
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => path.join(directory, file));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function requireIncluded(actual, expected, label) {
  for (const value of expected || [])
    assert.ok(actual.includes(value), label + ' missing: ' + value);
}

function requireExcluded(actual, expected, label) {
  for (const value of expected || [])
    assert.ok(!actual.includes(value), label + ' unexpectedly contains: ' + value);
}

function runClassifierFixture(filePath) {
  const fixture = readJson(filePath);
  const actual = classifyChange({ map, files: fixture.files, semantic: fixture.semantic || [] });
  const expected = fixture.expected;
  if (expected.lane) assert.equal(actual.lane, expected.lane, 'lane');
  if (expected.deterministicLane)
    assert.equal(actual.deterministic_lane, expected.deterministicLane, 'deterministic lane');
  if (expected.confidence)
    assert.equal(actual.classifier_confidence, expected.confidence, 'confidence');
  if (typeof expected.manualReviewRequired === 'boolean')
    assert.equal(actual.manual_review_required, expected.manualReviewRequired, 'manual review');
  requireIncluded(actual.impacts, expected.impactsInclude, 'impacts');
  requireExcluded(actual.impacts, expected.impactsExclude, 'impacts');
  requireIncluded(actual.required_evidence, expected.evidenceInclude, 'evidence');
  requireIncluded(actual.unknown_files, expected.unknownFilesInclude, 'unknown files');
  requireIncluded(
    actual.matching_dependency_edges.map((entry) => entry.rule),
    expected.dependencyEdgesInclude,
    'dependency edge',
  );
}

function runEvidenceFixture(filePath) {
  const fixture = readJson(filePath);
  const actual = evaluateEvidence(fixture.classification, catalog, fixture.jobs || {});
  assert.equal(actual.decision, fixture.expected.decision, 'decision');
  requireIncluded(
    actual.failed.map((entry) => entry.evidence),
    fixture.expected.failedEvidence,
    'failed evidence',
  );
  requireIncluded(
    actual.needs_review.map((entry) => entry.evidence),
    fixture.expected.needsReviewEvidence,
    'needs review evidence',
  );
}

function runSemanticDowngradeGuard() {
  assert.throws(
    () =>
      classifyChange({
        map,
        files: ['apps/web/src/PlanCanvas.tsx'],
        semantic: [{ action: 'remove', domain: 'document' }],
      }),
    /may not downgrade/,
  );
}

let failures = 0;
for (const filePath of fixtureFiles(path.join(root, 'fixtures/v5/classifier'))) {
  try {
    runClassifierFixture(filePath);
    process.stdout.write('PASS classifier ' + path.basename(filePath) + '\n');
  } catch (error) {
    failures += 1;
    process.stderr.write(
      'FAIL classifier ' + path.basename(filePath) + ': ' + error.message + '\n',
    );
  }
}
for (const filePath of fixtureFiles(path.join(root, 'fixtures/v5/evidence'))) {
  try {
    runEvidenceFixture(filePath);
    process.stdout.write('PASS evidence ' + path.basename(filePath) + '\n');
  } catch (error) {
    failures += 1;
    process.stderr.write('FAIL evidence ' + path.basename(filePath) + ': ' + error.message + '\n');
  }
}
try {
  runSemanticDowngradeGuard();
  process.stdout.write('PASS semantic downgrade guard\n');
} catch (error) {
  failures += 1;
  process.stderr.write('FAIL semantic downgrade guard: ' + error.message + '\n');
}
if (failures) {
  process.stderr.write(failures + ' fixture failure(s)\n');
  process.exitCode = 1;
} else {
  process.stdout.write('All Engineering OS 5.0 fixtures passed.\n');
}
