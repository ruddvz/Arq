#!/usr/bin/env node
/**
 * ARQ-115: benchmark Canvas 2D.
 *
 * Drives packages/plan-renderer/benchmarks/canvas-2d/canvas-2d-benchmark.html
 * in real headless Chromium (Playwright) and prints/saves the measured
 * frame-timing result - real numbers from an actual browser run, not a
 * hand-typed estimate. Compares against benchmarks/PERFORMANCE-BUDGETS.json's
 * panZoomFpsTarget.
 *
 * Usage: node scripts/run-canvas-2d-benchmark.mjs
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.__ARQ_BENCHMARK_RESULT__ !== undefined, {
      timeout: 30_000,
    });
    const result = await page.evaluate(() => window.__ARQ_BENCHMARK_RESULT__);

    const report = {
      timestamp: new Date().toISOString(),
      environment:
        'headless Chromium, sandboxed container (not a certified benchmark device - see docs/research/RENDERER-BENCHMARK-CANVAS-2D.md)',
      benchmarkModel: budgets.benchmarkModel,
      measuredObjectCounts: result.counts,
      frameCount: result.frameCount,
      avgFrameMs: result.avgFrameMs,
      avgFps: result.avgFps,
      p95FrameMs: result.p95FrameMs,
      maxFrameMs: result.maxFrameMs,
      panZoomFpsTarget: budgets.targets.panZoomFpsTarget,
      meetsTarget: result.avgFps >= budgets.targets.panZoomFpsTarget,
    };

    console.log(JSON.stringify(report, null, 2));

    const outDir = path.join(repoRoot, 'benchmarks/results');
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `canvas-2d-${report.timestamp.replace(/[:.]/g, '-')}.json`);
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
