#!/usr/bin/env node
/**
 * Enforces the startup bundle boundary from the canonical #402 performance
 * authority and records deferred-chunk sizes without inventing unreviewed size
 * thresholds. Structural markers ensure deferred libraries cannot drift back
 * into the startup entry while their absolute lazy-chunk budgets are pending a
 * measured reference baseline.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getStartupBundleBudget, readPerformanceAuthority } from './lib/performance-authority.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'apps/web/dist');
const authority = readPerformanceAuthority();
const canonicalStartup = getStartupBundleBudget(authority);

/** Backwards-compatible export for the existing self-test, derived from #402. */
export const BUDGET = {
  startupGzip: canonicalStartup.threshold,
};

export const DEFERRED_LIBRARIES = authority.bundle.deferred.map((entry) => ({
  id: entry.id,
  library: entry.library,
  marker: entry.marker,
  boundary: entry.boundary,
  sizeBudget: entry.sizeBudget,
  status: entry.status,
}));

export function findEntryScript(indexHtml) {
  const match = indexHtml.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
  return match ? path.basename(match[1]) : null;
}

export function evaluateBundle({ entryJs, cssBytes, entrySource }) {
  const findings = [];
  const startupGzip = gzipSync(Buffer.concat([entryJs, cssBytes])).length;

  if (startupGzip > BUDGET.startupGzip) {
    findings.push(
      `start-up payload is ${(startupGzip / 1024).toFixed(1)}KB gzipped, over the ` +
        `${BUDGET.startupGzip / 1024}KB canonical #402 budget. Fix the regression, or change ` +
        `benchmarks/PERFORMANCE-BUDGETS.json deliberately with user impact and evidence.`,
    );
  }

  for (const { library, marker, boundary } of DEFERRED_LIBRARIES) {
    if (entrySource.includes(marker)) {
      findings.push(
        `${library} is in the entry chunk (found "${marker}"). The boundary that should keep it ` +
          `deferred is: ${boundary}.`,
      );
    }
  }

  return { findings, startupGzip };
}

export function measureDeferredChunks({ assetsDir, entryName }) {
  const jsFiles = readdirSync(assetsDir).filter(
    (name) => name.endsWith('.js') && name !== entryName,
  );
  return DEFERRED_LIBRARIES.map((library) => {
    const matches = [];
    for (const name of jsFiles) {
      const bytes = readFileSync(path.join(assetsDir, name));
      if (bytes.toString('utf8').includes(library.marker)) {
        matches.push({
          file: name,
          rawBytes: bytes.length,
          gzipBytes: gzipSync(bytes).length,
        });
      }
    }
    return {
      id: library.id,
      library: library.library,
      status: library.status,
      sizeBudget: library.sizeBudget,
      chunks: matches,
      measurementStatus: matches.length > 0 ? 'measured-by-marker' : 'marker-not-resolved',
      measuredGzipBytes: matches.reduce((sum, chunk) => sum + chunk.gzipBytes, 0),
    };
  });
}

function main() {
  const indexPath = path.join(distDir, 'index.html');
  if (!existsSync(indexPath)) {
    process.stderr.write(
      `Cannot verify the bundle budget: ${path.relative(repoRoot, indexPath)} is absent. ` +
        'Run `pnpm build` first. Refusing to report a budget as met against a build that was never produced.\n',
    );
    process.exit(1);
  }

  const entryName = findEntryScript(readFileSync(indexPath, 'utf8'));
  if (entryName === null) {
    process.stderr.write('Cannot verify the bundle budget: index.html loads no module script.\n');
    process.exit(1);
  }

  const assetsDir = path.join(distDir, 'assets');
  const entryPath = path.join(assetsDir, entryName);
  const entryJs = readFileSync(entryPath);
  const cssFiles = readdirSync(assetsDir).filter((name) => name.endsWith('.css'));
  const cssBytes = Buffer.concat(cssFiles.map((name) => readFileSync(path.join(assetsDir, name))));
  const { findings, startupGzip } = evaluateBundle({
    entryJs,
    cssBytes,
    entrySource: entryJs.toString('utf8'),
  });
  const deferred = measureDeferredChunks({ assetsDir, entryName });

  for (const item of deferred) {
    if (
      item.sizeBudget !== null &&
      item.measurementStatus === 'measured-by-marker' &&
      item.measuredGzipBytes > item.sizeBudget
    ) {
      findings.push(
        `${item.library} deferred payload is ${(item.measuredGzipBytes / 1024).toFixed(1)}KB gzipped, ` +
          `over its canonical ${(item.sizeBudget / 1024).toFixed(1)}KB budget.`,
      );
    }
  }

  const report = {
    schemaVersion: 1,
    authority: 'benchmarks/PERFORMANCE-BUDGETS.json#bundle',
    startup: {
      entry: entryName,
      stylesheets: cssFiles,
      gzipBytes: startupGzip,
      budgetBytes: BUDGET.startupGzip,
      withinBudget: startupGzip <= BUDGET.startupGzip,
    },
    deferred,
    findings,
    ok: findings.length === 0,
  };
  const outDir = path.join(repoRoot, 'benchmarks/results');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, 'web-bundle-current.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  if (findings.length > 0) {
    for (const finding of findings) process.stderr.write(`FAIL ${finding}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `Start-up payload ${(startupGzip / 1024).toFixed(1)}KB gzipped ` +
      `(${entryName} + ${cssFiles.length} stylesheet(s)), within the canonical ` +
      `${BUDGET.startupGzip / 1024}KB #402 budget.\n`,
  );
  for (const item of deferred) {
    const measured =
      item.measurementStatus === 'measured-by-marker'
        ? `${(item.measuredGzipBytes / 1024).toFixed(1)}KB gzipped deferred`
        : 'deferred marker not uniquely resolved in built chunks';
    process.stdout.write(
      `${item.library}: ${measured} ` +
        `(${item.sizeBudget === null ? 'absolute size baseline pending, entry-boundary enforcement active' : `budget ${item.sizeBudget / 1024}KB`}).\n`,
    );
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
