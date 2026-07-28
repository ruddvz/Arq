#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const contractOnly = args.includes('--contract-only');
const repoRoot = resolve(value('--repo-root', process.cwd()));
const languageRoot = resolve(value('--language-root', join(repoRoot, 'docs/product/voice')));
function locate(name) {
  const candidates = [
    join(languageRoot, name),
    join(languageRoot, '02-canonical', name),
    join(PACKAGE_ROOT, '02-canonical', name),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Missing integration artifact: ${name}`);
  return found;
}
const contract = JSON.parse(readFileSync(locate('integration-contract.json'), 'utf8'));
const system = JSON.parse(readFileSync(locate('system-map.json'), 'utf8'));
let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FAIL ${message}`);
};
const unique = (values, label) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`duplicate ${label}: ${value}`);
    seen.add(value);
  }
};

if (contract.schemaVersion !== 2) fail('integration contract must use schema 2');
if (contract.version !== system.version)
  fail('integration contract version must match system version');
for (const field of ['requiredRepositoryFiles', 'requiredScripts']) {
  if (!Array.isArray(contract[field]) || !contract[field].length)
    fail(`integration contract ${field} must be non-empty`);
  else unique(contract[field], `integration contract ${field}`);
}
if (!contractOnly) {
  for (const path of contract.requiredRepositoryFiles ?? []) {
    if (!existsSync(join(repoRoot, path))) fail(`installed language artifact missing: ${path}`);
  }
  const packageJson = existsSync(join(repoRoot, 'package.json'))
    ? readFileSync(join(repoRoot, 'package.json'), 'utf8')
    : '';
  if (!packageJson) fail('package.json missing from repository root');
  for (const script of contract.requiredScripts ?? []) {
    if (!packageJson.includes(`\"${script}\"`)) fail(`package.json missing ${script}`);
  }
}
if (failures) process.exit(1);
console.log(
  `PASS language installation contract (${contract.requiredRepositoryFiles.length} files, ${contract.requiredScripts.length} scripts${contractOnly ? ', contract only' : ''}).`,
);
