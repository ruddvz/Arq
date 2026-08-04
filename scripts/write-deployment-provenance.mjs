#!/usr/bin/env node
/**
 * Deployment provenance: bind a built artifact to the exact source revision it
 * was built from, and refuse to continue when they disagree.
 *
 * The problem this closes is that a hosted build clones a *branch*, not a
 * commit. Between the moment a release is approved at some SHA and the moment
 * the builder checks out, the branch can move. Nothing downstream notices,
 * because the deployment is READY either way and the site looks right. The
 * footer revision comes from the same drifted checkout, so it agrees with
 * itself and confirms nothing.
 *
 * So the expected SHA has to arrive from outside the checkout. The caller
 * passes EXPECTED_SOURCE_SHA; this script resolves the actual HEAD and exits
 * non-zero on mismatch, before anything is published. A mismatch is a hard
 * failure and not a warning: a warning in a deploy log is a thing nobody reads
 * until after the wrong revision is live.
 *
 * It then writes a provenance record next to the artifact so the published site
 * carries proof of what produced it: both SHAs, the toolchain, the build
 * target, a hash per route, and a hash per emitted file. Post-deployment
 * verification reads that record back off the live URL, which is what makes it
 * evidence rather than a claim.
 *
 * Usage:
 *   EXPECTED_SOURCE_SHA=<sha> node scripts/write-deployment-provenance.mjs \
 *     --dist apps/marketing/dist --target github-pages [--allow-unpinned]
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const PROVENANCE_FILENAME = 'arq-deployment-provenance.json';

function parseArguments(argv) {
  const options = { dist: null, target: null, allowUnpinned: false, repoRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--dist') {
      options.dist = argv[index + 1];
      index += 1;
    } else if (option === '--target') {
      options.target = argv[index + 1];
      index += 1;
    } else if (option === '--repo-root') {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else if (option === '--allow-unpinned') {
      options.allowUnpinned = true;
    } else {
      throw new Error(`Unknown argument: ${option}`);
    }
  }
  if (options.dist === null) throw new Error('--dist is required');
  if (options.target === null) throw new Error('--target is required');
  return options;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function walkFiles(root, prefix = '') {
  const out = [];
  for (const name of readdirSync(path.join(root, prefix))) {
    const relative = prefix === '' ? name : `${prefix}/${name}`;
    const full = path.join(root, relative);
    if (statSync(full).isDirectory()) out.push(...walkFiles(root, relative));
    else out.push(relative);
  }
  return out.sort();
}

function toolVersion(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function buildProvenance({ dist, target, repoRoot, expectedSha, allowUnpinned }) {
  const errors = [];
  const actualSha = toolVersion('git', ['-C', repoRoot, 'rev-parse', 'HEAD']);

  if (!expectedSha) {
    if (!allowUnpinned) {
      errors.push(
        'EXPECTED_SOURCE_SHA is not set. A hosted build clones a branch, so without an ' +
          'expected revision from outside the checkout there is nothing to compare against ' +
          'and the build cannot state what it built. Pass --allow-unpinned only for a ' +
          'preview that is explicitly not a release.',
      );
    }
  } else if (actualSha === null) {
    errors.push('Could not resolve the actual source revision with git rev-parse HEAD.');
  } else if (expectedSha !== actualSha) {
    errors.push(
      `Source revision mismatch. Expected ${expectedSha}, built from ${actualSha}. ` +
        'The branch moved between approval and checkout; refusing to publish a revision ' +
        'nobody approved.',
    );
  }

  const distRoot = path.resolve(repoRoot, dist);
  if (!existsSync(distRoot)) {
    errors.push(`Build output is missing: ${dist}`);
    return { ok: false, errors, provenance: null };
  }

  const files = walkFiles(distRoot).filter((name) => name !== PROVENANCE_FILENAME);
  const artifacts = {};
  const routes = {};
  let totalBytes = 0;
  for (const relative of files) {
    const bytes = readFileSync(path.join(distRoot, relative));
    totalBytes += bytes.length;
    const digest = sha256(bytes);
    artifacts[relative] = { bytes: bytes.length, sha256: digest };
    if (relative.endsWith('.html')) {
      const route =
        relative === 'index.html'
          ? '/'
          : relative.endsWith('/index.html')
            ? `/${relative.slice(0, -'/index.html'.length)}/`
            : `/${relative.slice(0, -'.html'.length)}`;
      routes[route] = digest;
    }
  }

  if (Object.keys(routes).length === 0) {
    errors.push(`No HTML routes found under ${dist}; the build produced nothing to verify.`);
  }

  const provenance = {
    schema_version: 1,
    generator: 'scripts/write-deployment-provenance.mjs',
    target,
    expected_source_sha: expectedSha ?? null,
    actual_source_sha: actualSha,
    source_pinned: Boolean(expectedSha) && expectedSha === actualSha,
    built_at: new Date().toISOString(),
    toolchain: {
      node: process.version,
      pnpm: toolVersion('pnpm', ['--version']),
      platform: `${process.platform}-${process.arch}`,
    },
    output: {
      directory: dist,
      file_count: files.length,
      total_bytes: totalBytes,
      route_count: Object.keys(routes).length,
    },
    routes,
    artifacts,
  };

  return { ok: errors.length === 0, errors, provenance };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const expectedSha = (process.env.EXPECTED_SOURCE_SHA ?? '').trim() || null;
  const result = buildProvenance({ ...options, expectedSha });

  for (const error of result.errors) console.error(`FAIL ${error}`);

  if (result.provenance !== null) {
    const outPath = path.resolve(options.repoRoot, options.dist, PROVENANCE_FILENAME);
    // Written even on failure: when a mismatch stops a release, the record of
    // what was actually built is the first thing an investigation needs.
    writeFileSync(outPath, JSON.stringify(result.provenance, null, 2) + '\n');
    console.log(
      `${result.ok ? 'PASS' : 'RECORDED'} provenance for ${result.provenance.output.route_count} routes ` +
        `(${result.provenance.output.file_count} files) at ${result.provenance.actual_source_sha}`,
    );
    console.log(`Wrote ${path.relative(options.repoRoot, outPath)}`);
  }

  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
