#!/usr/bin/env node
/** Reconcile public content modules, route map and typed page registry. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const repoRoot = resolve(value('--repo-root', '.'));
const languageRoot = resolve(value('--language-root', PACKAGE_ROOT));

function locate(name) {
  const candidates = [
    join(languageRoot, '02-canonical', name),
    join(languageRoot, name),
    join(PACKAGE_ROOT, '02-canonical', name),
  ];
  const path = candidates.find(existsSync);
  if (!path) throw new Error(`Missing route-coverage artifact: ${name}`);
  return path;
}
function readJson(name) {
  return JSON.parse(readFileSync(locate(name), 'utf8'));
}
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const split = (line) => {
    const cells = [];
    let value = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        cells.push(value);
        value = '';
      } else {
        value += char;
      }
    }
    cells.push(value);
    return cells;
  };
  const headers = split(lines[0]);
  return lines
    .slice(1)
    .map((line) =>
      Object.fromEntries(headers.map((header, index) => [header, split(line)[index] ?? ''])),
    );
}
function sourceStem(path) {
  return path.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
}
function expectedOutputPath(route) {
  if (route === '/404') return '404.html';
  if (route === '/') return 'index.html';
  return `${route.replace(/^\//, '')}/index.html`;
}

const inventory = readJson('public-copy-inventory.json');
const contract = readJson('deployed-site-contract.json');
let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FAIL ${message}`);
};
const unique = (values, label) => {
  const seen = new Set();
  for (const item of values) {
    if (seen.has(item)) fail(`duplicate ${label}: ${item}`);
    seen.add(item);
  }
};

if (inventory.schemaVersion !== 2) fail('public-copy inventory must use schema 2');
if (contract.schemaVersion !== 1) fail('deployed-site contract must use schema 1');
if (inventory.routeMapPath !== contract.repository?.routeMapPath)
  fail('inventory and deployed-site contract disagree on route map path');
if (inventory.routeRegistryPath !== contract.repository?.routeRegistryPath)
  fail('inventory and deployed-site contract disagree on route registry path');

const routeMapPath = join(repoRoot, inventory.routeMapPath ?? '');
const routeRegistryPath = join(repoRoot, inventory.routeRegistryPath ?? '');
if (!existsSync(routeMapPath)) fail(`route map is missing: ${inventory.routeMapPath}`);
if (!existsSync(routeRegistryPath))
  fail(`route registry is missing: ${inventory.routeRegistryPath}`);
if (failures) process.exit(1);

const publicRoutes = parseCsv(readFileSync(routeMapPath, 'utf8')).filter(
  (row) => row.access === 'public',
);
const entries = inventory.entries ?? [];
const shippedEntries = entries.filter((entry) => entry.route !== '/404');
unique(
  entries.map((entry) => entry.id),
  'inventory id',
);
unique(
  entries.map((entry) => entry.sourcePath),
  'inventory source path',
);
unique(
  entries.map((entry) => entry.route),
  'inventory route',
);
unique(
  entries.map((entry) => entry.pageId),
  'inventory page id',
);

const routeByPath = new Map(publicRoutes.map((row) => [row.route, row]));
const entryByRoute = new Map(shippedEntries.map((entry) => [entry.route, entry]));
for (const row of publicRoutes) {
  const entry = entryByRoute.get(row.route);
  if (!entry) {
    fail(`public route ${row.route} (${row.id}) has no inventory entry`);
    continue;
  }
  if (entry.pageId !== row.id)
    fail(`inventory ${entry.id} page ID ${entry.pageId} does not match route-map ID ${row.id}`);
}
for (const entry of shippedEntries) {
  const row = routeByPath.get(entry.route);
  if (!row) fail(`inventory ${entry.id} route ${entry.route} is not a public route`);
  if (entry.outputPath && entry.outputPath !== expectedOutputPath(entry.route)) {
    fail(`inventory ${entry.id} has noncanonical output path ${entry.outputPath}`);
  }
}

const registryText = readFileSync(routeRegistryPath, 'utf8');
const importedStems = [...registryText.matchAll(/from '\.\/content\/([^']+)\.js'/g)].map(
  (match) => match[1],
);
unique(importedStems, 'route-registry content module');
const inventoryStems = entries.map((entry) => sourceStem(entry.sourcePath));
for (const stem of importedStems)
  if (!inventoryStems.includes(stem))
    fail(`route registry imports content module absent from inventory: ${stem}`);
for (const stem of inventoryStems)
  if (!importedStems.includes(stem))
    fail(`inventory content module is absent from route registry: ${stem}`);

for (const entry of entries) {
  const sourcePath = join(repoRoot, entry.sourcePath);
  if (!existsSync(sourcePath)) {
    fail(`inventory source is missing: ${entry.sourcePath}`);
    continue;
  }
  const source = readFileSync(sourcePath, 'utf8');
  const routeMatch = source.match(/route:\s*'([^']+)'/);
  const idMatch = source.match(/id:\s*'([^']+)'/);
  if (routeMatch && routeMatch[1] !== entry.route)
    fail(`${entry.sourcePath} declares ${routeMatch[1]}, inventory declares ${entry.route}`);
  if (idMatch && idMatch[1] !== entry.pageId)
    fail(`${entry.sourcePath} declares ${idMatch[1]}, inventory declares ${entry.pageId}`);
  if (!routeMatch) fail(`${entry.sourcePath} has no statically discoverable route metadata`);
  if (!idMatch) fail(`${entry.sourcePath} has no statically discoverable page ID metadata`);
}

if (failures) process.exit(1);
console.log(
  `PASS marketing route coverage (${publicRoutes.length} public routes, ${entries.length} content modules, 404 included).`,
);
