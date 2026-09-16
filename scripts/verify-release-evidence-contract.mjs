#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  loadReleasePolicy,
  validateReleaseManifest,
  validateReleasePolicy,
} from './lib/release-evidence-contract.mjs';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function main() {
  const repoRoot = path.resolve(argument('--repo-root') ?? process.cwd());
  const manifestPath = argument('--manifest');
  const expectedRevision = argument('--expected-revision');
  const policy = loadReleasePolicy(repoRoot);

  if (manifestPath === null) {
    const result = validateReleasePolicy(policy);
    for (const error of result.errors) console.error(`FAIL ${error}`);
    if (result.ok) console.log(`PASS release policy ${policy.policyId}`);
    process.exit(result.ok ? 0 : 1);
  }

  const resolvedManifestPath = path.resolve(repoRoot, manifestPath);
  const manifest = JSON.parse(readFileSync(resolvedManifestPath, 'utf8'));
  const result = validateReleaseManifest({ policy, manifest, expectedRevision });

  for (const error of result.errors) console.error(`FAIL ${error}`);
  for (const blocker of result.blockers) console.error(`BLOCK ${blocker}`);
  if (result.ok) {
    console.log(
      `PASS ${manifest.releaseStage} release evidence at ${manifest.releaseRevision} (${manifest.evidence.length} receipts)`,
    );
  }
  process.exit(result.ok ? 0 : 1);
}

main();
