#!/usr/bin/env node
/** Verify that the public deployment matches the exact audited static artifact. */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { externalLoadedResourceUrls, scanRenderedPublicHtml } from './arq-language-patterns.mjs';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const languageRoot = resolve(value('--language-root', join(PACKAGE_ROOT, 'docs/product/voice')));
const baseUrlValue = value('--base-url', '');
const expectedCommit = value('--expected-commit', process.env.GITHUB_SHA ?? '');
const attempts = Number(value('--attempts', '4'));
const delayMs = Number(value('--delay-ms', '3000'));
function locate(name) {
  const candidates = [
    join(languageRoot, '02-canonical', name),
    join(languageRoot, name),
    join(PACKAGE_ROOT, '02-canonical', name),
  ];
  const path = candidates.find(existsSync);
  if (!path) throw new Error(`Missing deployed-site artifact: ${name}`);
  return path;
}
const contract = JSON.parse(readFileSync(locate('deployed-site-contract.json'), 'utf8'));
const system = JSON.parse(readFileSync(locate('system-map.json'), 'utf8'));
if (!baseUrlValue) {
  console.error('FAIL deployed-site verification requires --base-url');
  process.exit(1);
}
if (!/^[0-9a-f]{7,64}$/i.test(expectedCommit)) {
  console.error('FAIL deployed-site verification requires --expected-commit with a Git SHA');
  process.exit(1);
}
const baseUrl = new URL(baseUrlValue.endsWith('/') ? baseUrlValue : `${baseUrlValue}/`);
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const wait = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
async function fetchText(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    redirect: 'follow',
    headers: { 'cache-control': 'no-cache' },
  });
  const text = await response.text();
  return { response, text };
}
async function loadProofWithRetry() {
  const proofUrl = new URL(contract.proof?.fileName ?? 'arq-language-site-proof.json', baseUrl);
  let last = '';
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { response, text } = await fetchText(proofUrl);
      if (!response.ok) {
        last = `${response.status} ${response.statusText}`;
      } else {
        const proof = JSON.parse(text);
        if (proof.commitSha === expectedCommit) return proof;
        last = `expected ${expectedCommit}, received ${proof.commitSha ?? '(missing)'}`;
      }
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    if (attempt < attempts) await wait(delayMs);
  }
  throw new Error(
    `deployed proof did not reach expected commit after ${attempts} attempt(s): ${last}`,
  );
}

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FAIL ${message}`);
};
let proof;
try {
  proof = await loadProofWithRetry();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
if (!proof) process.exit(1);
if (proof.schemaVersion !== 1) fail('deployed proof has unsupported schema version');
if (proof.languageContractVersion !== system.contractVersion)
  fail('deployed proof language contract does not match the installed system');
if (proof.routeHashAlgorithm !== (contract.proof?.routeHashAlgorithm ?? 'sha256'))
  fail('deployed proof has an unexpected route hash algorithm');
if (!Array.isArray(proof.routes) || !proof.routes.length) fail('deployed proof has no routes');
const seen = new Set();
for (const route of proof.routes ?? []) {
  if (seen.has(route.route)) {
    fail(`deployed proof has duplicate route ${route.route}`);
    continue;
  }
  seen.add(route.route);
  const relative =
    route.outputPath === '404.html'
      ? '404.html'
      : route.route === '/'
        ? ''
        : `${route.route.replace(/^\//, '')}/`;
  const url = new URL(relative, baseUrl);
  try {
    const { response, text } = await fetchText(url);
    if (!response.ok) {
      fail(`${route.route} returned ${response.status}`);
      continue;
    }
    if (sha256(text) !== route.sha256)
      fail(`${route.route} response hash does not match deployed proof`);
    for (const finding of scanRenderedPublicHtml(text).filter((item) => item.severity === 'hard')) {
      fail(
        `${route.route} violates ${finding.id}: ${[...new Set(finding.hits)].slice(0, 4).join(' | ')}`,
      );
    }
    const externalResources = externalLoadedResourceUrls(text);
    if (externalResources.length)
      fail(`${route.route} loads external resource(s): ${externalResources.join(', ')}`);
  } catch (error) {
    fail(
      `${route.route} could not be fetched: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
if (failures) process.exit(1);
console.log(`PASS deployed public site (${proof.routes.length} routes, commit ${expectedCommit}).`);
