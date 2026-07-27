#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const languageRoot = resolve(value('--language-root', PACKAGE_ROOT));
const repoRoot = args.includes('--repo-root') ? resolve(value('--repo-root', '.')) : null;
function locate(name) {
  const candidates = [
    join(languageRoot, '02-canonical', name),
    join(languageRoot, name),
    join(PACKAGE_ROOT, '02-canonical', name),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Missing public-copy artifact: ${name}`);
  return found;
}
const read = (name) => JSON.parse(readFileSync(locate(name), 'utf8'));
const inventory = read('public-copy-inventory.json');
const bindings = read('claim-binding-registry.json');
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
const nonEmpty = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`);
};
function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

if (inventory.schemaVersion !== 2) fail('public-copy inventory must use schema 2');
nonEmpty(inventory.contentRoot, 'public-copy content root');
nonEmpty(inventory.routeMapPath, 'public-copy route map path');
nonEmpty(inventory.routeRegistryPath, 'public-copy route registry path');
const extensions = inventory.includedExtensions ?? [];
if (!Array.isArray(extensions) || !extensions.length)
  fail('public-copy inventory needs included extensions');
const entries = inventory.entries ?? [];
unique(
  entries.map((entry) => entry.id),
  'public-copy inventory id',
);
unique(
  entries.map((entry) => entry.sourcePath),
  'public-copy inventory source path',
);
unique(
  entries.map((entry) => entry.pageId),
  'public-copy inventory page id',
);
unique(
  entries.map((entry) => entry.route),
  'public-copy inventory route',
);
const byBinding = new Map((bindings.bindings ?? []).map((binding) => [binding.id, binding]));
const listedBindingIds = [];
for (const entry of entries) {
  nonEmpty(entry.id, 'public-copy entry id');
  nonEmpty(entry.pageId, `public-copy ${entry.id} page ID`);
  nonEmpty(entry.route, `public-copy ${entry.id} route`);
  nonEmpty(entry.sourcePath, `public-copy ${entry.id} source path`);
  nonEmpty(entry.owner, `public-copy ${entry.id} owner`);
  if (!entry.sourcePath.startsWith(`${inventory.contentRoot}/`))
    fail(`${entry.id} is outside public-copy content root`);
  if (!entry.route.startsWith('/')) fail(`${entry.id} route must start with /`);
  if (!['claim-bearing', 'non-claim'].includes(entry.classification))
    fail(`${entry.id} has invalid classification`);
  if (!Array.isArray(entry.reviewTriggers) || !entry.reviewTriggers.length)
    fail(`${entry.id} needs review triggers`);
  if (!Array.isArray(entry.claimBindingIds)) fail(`${entry.id} needs claimBindingIds`);
  if (entry.classification === 'claim-bearing' && !entry.claimBindingIds.length)
    fail(`${entry.id} is claim-bearing but has no bindings`);
  if (entry.classification === 'non-claim') {
    if (entry.claimBindingIds.length) fail(`${entry.id} is non-claim but has bindings`);
    nonEmpty(entry.nonClaimReason, `${entry.id} non-claim reason`);
  }
  unique(entry.claimBindingIds ?? [], `${entry.id} binding id`);
  for (const id of entry.claimBindingIds ?? []) {
    listedBindingIds.push(id);
    const binding = byBinding.get(id);
    if (!binding) {
      fail(`${entry.id} references unknown binding ${id}`);
      continue;
    }
    if (binding.sourcePath !== entry.sourcePath)
      fail(`${entry.id} binding ${id} points to another source path`);
  }
}
unique(listedBindingIds, 'public-copy listed binding');
for (const binding of bindings.bindings ?? []) {
  if (!binding.sourcePath?.startsWith(`${inventory.contentRoot}/`)) continue;
  if (!listedBindingIds.includes(binding.id))
    fail(`claim binding ${binding.id} is absent from public-copy inventory`);
}

if (repoRoot) {
  const contentDir = join(repoRoot, inventory.contentRoot);
  if (!existsSync(contentDir) || !statSync(contentDir).isDirectory()) {
    fail(`public-copy content root is missing in repository: ${inventory.contentRoot}`);
  } else {
    const live = walk(contentDir)
      .map((path) => relative(repoRoot, path).replace(/\\/g, '/'))
      .filter((path) => extensions.some((extension) => path.endsWith(extension)))
      .sort();
    const declared = entries.map((entry) => entry.sourcePath).sort();
    if (JSON.stringify(live) !== JSON.stringify(declared)) {
      const missing = live.filter((path) => !declared.includes(path));
      const stale = declared.filter((path) => !live.includes(path));
      if (missing.length)
        fail(`public-copy inventory misses live source(s): ${missing.join(', ')}`);
      if (stale.length) fail(`public-copy inventory lists missing source(s): ${stale.join(', ')}`);
    }
  }
}

if (failures) process.exit(1);
console.log(
  `PASS public-copy inventory (${entries.length} sources, ${listedBindingIds.length} claim bindings${repoRoot ? ', live directory checked' : ''}).`,
);
