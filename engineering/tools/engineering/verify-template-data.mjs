#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const errors = [];
const schema = read('templates/ops/release-manifest.schema.json');
const example = read('templates/ops/release-manifest.example.json');
const evidenceBundle = read('templates/ops/evidence-bundle.example.json');

for (const key of schema.required || []) {
  if (!Object.hasOwn(example, key))
    errors.push('Release manifest example is missing required property ' + key);
}
const lanes = schema.properties?.lane?.enum || [];
if (!lanes.includes(example.lane))
  errors.push('Release manifest example lane is not allowed by schema.');
const statuses = schema.properties?.status?.enum || [];
if (!statuses.includes(example.status))
  errors.push('Release manifest example status is not allowed by schema.');
for (const key of schema.properties?.evidence?.required || []) {
  if (!Array.isArray(example.evidence?.[key]))
    errors.push('Release manifest evidence.' + key + ' must be an array.');
}
if (evidenceBundle.schema_version !== 1)
  errors.push('Evidence-bundle example must declare schema_version 1.');
for (const key of ['selected', 'passed', 'failed', 'needs_review', 'missing_mappings']) {
  if (!Array.isArray(evidenceBundle.evidence?.[key]))
    errors.push('Evidence-bundle example evidence.' + key + ' must be an array.');
}
if (!['pass', 'fail', 'needs_review'].includes(evidenceBundle.decision))
  errors.push('Evidence-bundle example decision is invalid.');

if (errors.length) {
  for (const error of errors) process.stderr.write('TEMPLATE DATA ERROR: ' + error + '\n');
  process.exitCode = 1;
} else {
  process.stdout.write('Template examples agree with their 5.0 data contract.\n');
}
