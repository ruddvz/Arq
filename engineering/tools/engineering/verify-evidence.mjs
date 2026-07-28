#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function catalogIndex(catalog) {
  const entries = Array.isArray(catalog) ? catalog : catalog?.evidence;
  if (!Array.isArray(entries)) fail('Evidence catalog requires an evidence array.');
  const index = new Map();
  for (const entry of entries) {
    if (!entry?.id) fail('Every evidence entry requires an id.');
    if (index.has(entry.id)) fail('Duplicate evidence id: ' + entry.id);
    index.set(entry.id, entry);
  }
  return index;
}

function parseArguments(argv) {
  const options = { jobs: {} };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    const next = argv[index + 1];
    if (option === '--classification') {
      options.classification = next;
      index += 1;
    } else if (option === '--catalog') {
      options.catalog = next;
      index += 1;
    } else if (option === '--jobs-file') {
      options.jobsFile = next;
      index += 1;
    } else if (option === '--job') {
      const separator = String(next).indexOf('=');
      if (separator < 1) fail('--job must be NAME=RESULT.');
      options.jobs[next.slice(0, separator)] = next.slice(separator + 1);
      index += 1;
    } else if (option === '--output') {
      options.output = next;
      index += 1;
    } else if (option === '--help') {
      options.help = true;
    } else {
      fail('Unknown argument: ' + option);
    }
  }
  return options;
}

function entryDecision(entry, jobResult) {
  const state = entry.state || 'available';
  const job = entry.job || entry.id;
  if (state === 'missing') {
    return { category: 'hard-fail', job, reason: 'Proof gap is not closed.' };
  }
  if (
    state === 'requires-github-environment' ||
    entry.kind === 'protected-approval' ||
    entry.kind === 'manual-record'
  ) {
    if (jobResult === 'success') return { category: 'pass', job };
    return {
      category: 'needs-review',
      job,
      reason: 'Protected or designated-owner approval is required.',
    };
  }
  if (jobResult === 'success') return { category: 'pass', job };
  return { category: 'hard-fail', job, reason: 'Required evidence job did not succeed.' };
}

export function evaluateEvidence(classification, catalog, jobs) {
  const index = catalogIndex(catalog);
  const selected = [...new Set(classification.required_evidence || [])].sort();
  const passed = [];
  const failed = [];
  const needsReview = [];
  const missingMappings = [];

  for (const id of selected) {
    const entry = index.get(id);
    if (!entry) {
      missingMappings.push({ evidence: id, reason: 'No catalog entry.' });
      continue;
    }
    const job = entry.job || id;
    const result = jobs[job] || jobs[id] || 'missing';
    const outcome = entryDecision(entry, result);
    const record = { evidence: id, job: outcome.job, result, state: entry.state || 'available' };
    if (outcome.category === 'pass') passed.push(record);
    else if (outcome.category === 'needs-review')
      needsReview.push({ ...record, reason: outcome.reason });
    else failed.push({ ...record, reason: outcome.reason });
  }

  if (classification.manual_review_required && !selected.includes('protected_l4_approval')) {
    needsReview.push({
      evidence: 'protected_l4_approval',
      job: 'protected_l4_approval',
      result: 'missing',
      state: 'required-by-lane',
      reason: 'L4 classification requires protected approval evidence.',
    });
  }

  const decision =
    missingMappings.length || failed.length ? 'fail' : needsReview.length ? 'needs_review' : 'pass';
  return {
    schema_version: 1,
    decision,
    selected_evidence: selected,
    passed,
    failed,
    needs_review: needsReview,
    missing_mappings: missingMappings,
    manual_review_required: Boolean(classification.manual_review_required),
    summary: {
      selected: selected.length,
      passed: passed.length,
      failed: failed.length + missingMappings.length,
      needs_review: needsReview.length,
    },
  };
}

function printHelp() {
  process.stdout.write(
    'Usage: node verify-evidence.mjs --classification classification.json --catalog evidence-catalog.json [--jobs-file selected-evidence.json] --job evidence-id=success [--output result.json]\n',
  );
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) return printHelp();
  if (!options.classification || !options.catalog)
    fail('--classification and --catalog are required.');
  const fromFile = options.jobsFile
    ? readJson(options.jobsFile).jobs || readJson(options.jobsFile)
    : {};
  const result = evaluateEvidence(readJson(options.classification), readJson(options.catalog), {
    ...fromFile,
    ...options.jobs,
  });
  if (options.output) writeJson(options.output, result);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.decision !== 'pass') process.exitCode = 1;
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) runCli();
