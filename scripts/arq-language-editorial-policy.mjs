#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RULES } from './arq-language-patterns.mjs';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const languageRoot = resolve(value('--language-root', PACKAGE_ROOT));
function locate(name) {
  const candidates = [
    join(languageRoot, '02-canonical', name),
    join(languageRoot, name),
    join(PACKAGE_ROOT, '02-canonical', name),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Missing editorial language artifact: ${name}`);
  return found;
}
const read = (name) => JSON.parse(readFileSync(locate(name), 'utf8'));
const policy = read('editorial-authenticity-policy.json');
const acknowledgements = read('language-audit-acknowledgements.json');
const system = read('system-map.json');
let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FAIL ${message}`);
};
const pass = (message) => console.log(`PASS ${message}`);
const nonEmpty = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`);
};
const unique = (values, label) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
};

if (policy.schemaVersion !== 1) fail('editorial policy must use schema 1');
if (policy.policyVersion !== system.version)
  fail('editorial policy version must match system version');
for (const key of ['purpose']) nonEmpty(policy[key], `editorial policy ${key}`);
for (const key of ['goals', 'nonGoals', 'reviewOrder', 'manualReviewChecks']) {
  if (!Array.isArray(policy[key]) || !policy[key].length)
    fail(`editorial policy ${key} must be a non-empty array`);
}
if (!(policy.nonGoals ?? []).some((item) => /authorship/i.test(item)))
  fail('editorial policy must reject authorship inference');
if (!(policy.nonGoals ?? []).some((item) => /detector/i.test(item)))
  fail('editorial policy must reject detector optimisation');
if (
  typeof policy.referenceHandling?.method !== 'string' ||
  !policy.referenceHandling.method.trim()
) {
  fail('editorial policy must explain how it handles descriptive editorial references');
}
if (
  !Array.isArray(policy.referenceHandling?.notSufficientOnTheirOwn) ||
  !policy.referenceHandling.notSufficientOnTheirOwn.length
) {
  fail('editorial policy must name signals that cannot establish authorship');
}
if (!/house-style/i.test(policy.referenceHandling?.houseStyleException ?? '')) {
  fail(
    'editorial policy must identify U+2014 as a house-style decision, not an authorship inference',
  );
}

const ruleIds = new Set(RULES.map((rule) => rule.id));
const ruleById = new Map(RULES.map((rule) => [rule.id, rule]));
const categories = policy.categories ?? [];
unique(
  categories.map((category) => category.id),
  'editorial category id',
);
const referencedRuleIds = [];
for (const category of categories) {
  nonEmpty(category.id, 'editorial category id');
  nonEmpty(category.risk, `editorial category ${category.id} risk`);
  nonEmpty(category.requiredReview, `editorial category ${category.id} requiredReview`);
  const ids = [category.lintRuleId, ...(category.lintRuleIds ?? [])].filter(Boolean);
  if (!ids.length) fail(`editorial category ${category.id} has no lint rule`);
  for (const id of ids) {
    referencedRuleIds.push(id);
    if (!ruleIds.has(id))
      fail(`editorial category ${category.id} references unknown lint rule ${id}`);
  }
}
unique(referencedRuleIds, 'editorial policy lint rule reference');

const requiredAckFields = policy.acknowledgementRequirements?.mustContain ?? [];
for (const field of requiredAckFields) {
  if (!(acknowledgements.requiredFields ?? []).includes(field))
    fail(`acknowledgement registry misses required field ${field}`);
}
const maxDays = policy.acknowledgementRequirements?.maximumLifetimeDays;
if (!Number.isInteger(maxDays) || maxDays < 1)
  fail('editorial policy acknowledgement maximum lifetime must be a positive integer');
if (acknowledgements.maximumLifetimeDays !== maxDays)
  fail('acknowledgement maximum lifetime must match editorial policy');
const today = new Date();
const maxExpiry = new Date(today.getTime() + maxDays * 24 * 60 * 60 * 1000);
for (const entry of acknowledgements.acknowledgements ?? []) {
  for (const field of requiredAckFields) nonEmpty(entry[field], `acknowledgement ${field}`);
  if (!ruleIds.has(entry.ruleId)) fail(`acknowledgement uses unknown rule ${entry.ruleId}`);
  if (ruleById.get(entry.ruleId)?.severity === 'hard')
    fail(`acknowledgement cannot suppress hard rule ${entry.ruleId}`);
  const expiry = new Date(`${entry.expiresOn}T23:59:59Z`);
  if (Number.isNaN(expiry.getTime())) fail(`acknowledgement ${entry.ruleId} has invalid expiry`);
  else if (expiry < today) fail(`acknowledgement ${entry.ruleId} has expired`);
  else if (expiry > maxExpiry)
    fail(`acknowledgement ${entry.ruleId} exceeds ${maxDays}-day maximum`);
}

if (failures) process.exit(1);
pass(
  `${categories.length} editorial categories and ${referencedRuleIds.length} governed review rules`,
);
