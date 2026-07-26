#!/usr/bin/env node
/**
 * ARQ-151: add render frame benchmark.
 *
 * Drives the same real benchmark page ARQ-115's Canvas 2D pan/zoom
 * benchmark uses (packages/plan-renderer/benchmarks/canvas-2d/
 * canvas-2d-benchmark.html) in real headless Chromium (Playwright),
 * but reads back timeToFirstFrameMs - the one measurement that harness
 * captures and the pan/zoom benchmark deliberately excludes from its
 * own stats (see that file's own doc comment: warm-up/first-paint cost
 * is a one-time expense belonging to a different budget). This script
 * is that budget: section 120's "local project interactive under 2
 * seconds after data is available".
 *
 * Usage: node scripts/run-render-frame-benchmark.mjs
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * `/opt/pw-browsers/chromium` is this development sandbox's own pre-installed
 * browser path (see PLAYWRIGHT_BROWSERS_PATH) - real, but not portable to a
 * plain CI runner, where `npx playwright install --with-deps chromium`
 * installs to Playwright's own default cache instead. Using the sandbox path
 * unconditionally meant this script had never actually been exercised
 * outside this sandbox until it was first wired into CI, where it failed
 * immediately: "Failed to launch chromium because executable doesn't exist
 * at /opt/pw-browsers/chromium". Falling back to `undefined` (Playwright's
 * own resolution) when that specific path is absent fixes both environments
 * without special-casing CI.
 */
function resolveChromiumExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(
  repoRoot,
  'packages/plan-renderer/benchmarks/canvas-2d/canvas-2d-benchmark.html',
);
const budgetsPath = path.join(repoRoot, 'benchmarks/PERFORMANCE-BUDGETS.json');

async function main() {
  const budgets = JSON.parse(readFileSync(budgetsPath, 'utf8'));

  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.__ARQ_BENCHMARK_RESULT__ !== undefined, {
      timeout: 30_000,
    });
    const result = await page.evaluate(() => window.__ARQ_BENCHMARK_RESULT__);

    const targetMs = budgets.targets.localInteractiveSeconds * 1000;
    const report = {
      timestamp: new Date().toISOString(),
      environment:
        "headless Chromium, sandboxed container (not a certified benchmark device - see benchmarks/PERFORMANCE-BUDGETS.json's benchmarkDevice)",
      benchmarkModel: budgets.benchmarkModel,
      measuredObjectCounts: result.counts,
      timeToFirstFrameMs: result.timeToFirstFrameMs,
      localInteractiveTargetMs: targetMs,
      meetsTarget: result.timeToFirstFrameMs < targetMs,
    };

    console.log(JSON.stringify(report, null, 2));

    const outDir = path.join(repoRoot, 'benchmarks/results');
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(
      outDir,
      `render-frame-${report.timestamp.replace(/[:.]/g, '-')}.json`,
    );
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nSaved to ${path.relative(repoRoot, outPath)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
