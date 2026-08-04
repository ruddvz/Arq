#!/usr/bin/env node
/**
 * Keeps the declared toolchain and the toolchain CI actually uses from drifting
 * apart.
 *
 * `engines.node` was `>=20` with no upper bound, which is a claim that every
 * future major works. Nothing had tested one. Meanwhile every workflow pins
 * Node 20, so the declared policy and the exercised policy were different
 * statements and neither referenced the other. The same applies to pnpm:
 * `packageManager` pins an exact version, and a workflow that sets a different
 * one silently resolves a different dependency graph than the lockfile was
 * written for.
 *
 * This check asserts three things:
 *
 *   1. `engines.node` declares an upper bound, so the supported range is a
 *      statement about tested versions rather than about the future;
 *   2. every `node-version` in a workflow falls inside that range;
 *   3. no workflow pins a pnpm version that disagrees with `packageManager`.
 *
 * Usage: node scripts/verify-toolchain-policy.mjs [--repo-root <dir>]
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const WORKFLOW_DIRECTORY = '.github/workflows';
const NODE_VERSION = /node-version:\s*'?"?(\d+)(?:\.[\dx]+)*'?"?/g;
const PNPM_VERSION = /(?:^|\n)\s*version:\s*'?"?(\d+(?:\.\d+)*)'?"?/g;

function parseRange(range) {
  // Supports the ">=X <Y" shape this repository uses. Anything else is reported
  // rather than guessed at, because silently misreading a range would make this
  // check pass for the wrong reason.
  const lower = /(?:^|\s)>=\s*(\d+)/.exec(range);
  const upper = /(?:^|\s)<\s*(\d+)/.exec(range);
  return {
    lower: lower ? Number(lower[1]) : null,
    upper: upper ? Number(upper[1]) : null,
    understood: Boolean(lower),
  };
}

export function verifyToolchainPolicy(repoRoot = process.cwd()) {
  const errors = [];
  const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const declared = manifest.engines?.node ?? null;
  const packageManager = manifest.packageManager ?? null;

  if (declared === null) {
    errors.push('package.json declares no engines.node');
    return { ok: false, errors, summary: {} };
  }
  const range = parseRange(declared);
  if (!range.understood) {
    errors.push(`engines.node "${declared}" is not a ">=X <Y" range this check can read`);
  }
  if (range.upper === null) {
    errors.push(
      `engines.node "${declared}" has no upper bound, which claims every future Node major is ` +
        'supported. Declare the range that has actually been exercised.',
    );
  }

  const pnpmPin = packageManager === null ? null : /pnpm@(\d+(?:\.\d+)*)/.exec(packageManager)?.[1];
  if (pnpmPin === undefined || pnpmPin === null) {
    errors.push('package.json declares no packageManager pnpm pin');
  }

  const workflowDirectory = path.join(repoRoot, WORKFLOW_DIRECTORY);
  const nodeVersionsSeen = new Set();
  const pnpmVersionsSeen = new Set();
  if (existsSync(workflowDirectory)) {
    for (const name of readdirSync(workflowDirectory)) {
      if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue;
      const contents = readFileSync(path.join(workflowDirectory, name), 'utf8');
      for (const match of contents.matchAll(NODE_VERSION)) {
        const major = Number(match[1]);
        nodeVersionsSeen.add(major);
        if (range.lower !== null && major < range.lower) {
          errors.push(
            `${WORKFLOW_DIRECTORY}/${name} uses Node ${major}, below engines.node ${declared}`,
          );
        }
        if (range.upper !== null && major >= range.upper) {
          errors.push(
            `${WORKFLOW_DIRECTORY}/${name} uses Node ${major}, which engines.node ${declared} does not cover`,
          );
        }
      }
      // pnpm/action-setup takes its version from `packageManager` unless a
      // workflow overrides it, so only an explicit override is a finding.
      if (contents.includes('pnpm/action-setup')) {
        const block = contents.slice(contents.indexOf('pnpm/action-setup'));
        const explicit = PNPM_VERSION.exec(block);
        PNPM_VERSION.lastIndex = 0;
        if (explicit && pnpmPin && explicit[1] !== pnpmPin) {
          pnpmVersionsSeen.add(explicit[1]);
          errors.push(
            `${WORKFLOW_DIRECTORY}/${name} pins pnpm ${explicit[1]} but packageManager is pnpm@${pnpmPin}`,
          );
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    summary: {
      engines_node: declared,
      package_manager: packageManager,
      workflow_node_majors: [...nodeVersionsSeen].sort((a, b) => a - b),
      workflow_pnpm_overrides: [...pnpmVersionsSeen],
    },
  };
}

function main() {
  const rootIndex = process.argv.indexOf('--repo-root');
  const repoRoot = rootIndex === -1 ? process.cwd() : process.argv[rootIndex + 1];
  const result = verifyToolchainPolicy(repoRoot);
  for (const error of result.errors) console.error(`FAIL ${error}`);
  if (result.ok) {
    console.log(
      `PASS engines.node ${result.summary.engines_node} covers workflow Node ` +
        `${result.summary.workflow_node_majors.join(', ')} with ${result.summary.package_manager}`,
    );
  }
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
