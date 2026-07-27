#!/usr/bin/env node
/** Verify static public HTML and optionally bind it to a commit-bound proof. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { externalLoadedResourceUrls, scanRenderedPublicHtml } from './arq-language-patterns.mjs';

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
  if (!path) throw new Error(`Missing rendered-site artifact: ${name}`);
  return path;
}
function readJson(name) {
  return JSON.parse(readFileSync(locate(name), 'utf8'));
}
function outputPath(route) {
  if (route === '/404') return '404.html';
  if (route === '/') return 'index.html';
  return `${route.replace(/^\//, '')}/index.html`;
}
function digest(text) {
  return createHash('sha256').update(text).digest('hex');
}

const inventory = readJson('public-copy-inventory.json');
const contract = readJson('deployed-site-contract.json');
const system = readJson('system-map.json');
const siteRoot = resolve(
  value(
    '--site-root',
    join(repoRoot, contract.repository?.staticOutputPath ?? 'apps/marketing/dist'),
  ),
);
const writeProof = args.includes('--write-proof');
const commit = value('--commit', process.env.GITHUB_SHA ?? '');
const proofPath = join(siteRoot, contract.proof?.fileName ?? 'arq-language-site-proof.json');
let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FAIL ${message}`);
};

if (!existsSync(siteRoot)) fail(`static site output is missing: ${siteRoot}`);
if (writeProof && !/^[0-9a-f]{7,64}$/i.test(commit))
  fail('proof writing requires --commit with a Git SHA');
if (failures) process.exit(1);

const routes = [];
for (const entry of inventory.entries ?? []) {
  const relativePath = outputPath(entry.route);
  const path = join(siteRoot, relativePath);
  if (!existsSync(path)) {
    fail(`rendered public route is missing: ${entry.route} (${relativePath})`);
    continue;
  }
  const html = readFileSync(path, 'utf8');
  if (!/^<!doctype html>/i.test(html.trim()))
    fail(`rendered route lacks an HTML doctype: ${entry.route}`);
  const findings = scanRenderedPublicHtml(html).filter((finding) => finding.severity === 'hard');
  for (const finding of findings) {
    const uniqueHits = [...new Set(finding.hits)].slice(0, 4).join(' | ');
    fail(`${entry.route} violates ${finding.id}: ${uniqueHits}`);
  }
  const externalResources = externalLoadedResourceUrls(html);
  if (externalResources.length)
    fail(`${entry.route} loads external resource(s): ${externalResources.join(', ')}`);
  routes.push({
    id: entry.pageId,
    route: entry.route,
    outputPath: relativePath,
    sha256: digest(html),
  });
}

if (failures) process.exit(1);
if (writeProof) {
  mkdirSync(dirname(proofPath), { recursive: true });
  const proof = {
    schemaVersion: 1,
    languageContractVersion: system.contractVersion,
    commitSha: commit,
    routeHashAlgorithm: contract.proof?.routeHashAlgorithm ?? 'sha256',
    routes,
  };
  writeFileSync(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(`Wrote rendered-site proof ${proofPath}.`);
}
console.log(
  `PASS rendered public site (${routes.length} routes, ${writeProof ? 'proof written' : 'proof not written'}).`,
);
