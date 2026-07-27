#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const repoRoot = args.includes('--repo-root')
  ? resolve(args[args.indexOf('--repo-root') + 1])
  : null;
const languageRoot = resolve(
  args.includes('--language-root')
    ? args[args.indexOf('--language-root') + 1]
    : join(ROOT, 'docs/product/voice'),
);
/* Installed layout keeps canonical data flat under docs/product/voice/. */
const contractPath = [
  join(languageRoot, 'context-contract.json'),
  join(languageRoot, '02-canonical/context-contract.json'),
  join(ROOT, '02-canonical/context-contract.json'),
].find(existsSync);
if (!contractPath) {
  console.error('FAIL context-contract.json not found under the language root');
  process.exit(1);
}
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};
const ids = new Set();
const paths = new Set();
for (const source of contract.sourceSets ?? []) {
  if (ids.has(source.id)) fail(`duplicate source set ${source.id}`);
  if (paths.has(source.path)) fail(`duplicate source path ${source.path}`);
  ids.add(source.id);
  paths.add(source.path);
  if (isAbsolute(source.path) || source.path.includes('..'))
    fail(`${source.id} has unsafe source path`);
  if (!['file', 'directory'].includes(source.kind)) fail(`${source.id} has invalid source kind`);
  if (repoRoot && source.required) {
    const path = join(repoRoot, source.path);
    if (!existsSync(path)) fail(`required source missing: ${source.path}`);
    else if ((source.kind === 'file') !== statSync(path).isFile())
      fail(`${source.id} kind does not match ${source.path}`);
  }
}
if (failures) process.exit(1);
console.log(
  `PASS source contract (${contract.sourceSets?.length ?? 0} source sets${repoRoot ? ', live paths checked' : ''}).`,
);
