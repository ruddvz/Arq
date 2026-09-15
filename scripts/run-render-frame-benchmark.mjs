#!/usr/bin/env node
/**
 * Measures protected-scene data-available to first completed Plan render in
 * real headless Chromium. The target and regression policy come exclusively
 * from benchmarks/PERFORMANCE-BUDGETS.json.
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getWorkflow, readPerformanceAuthority } from './lib/performance-authority.mjs';

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

async function main() {
  const authority = readPerformanceAuthority();
  const workflow = getWorkflow(authority, 'plan.first-frame');
  const targetMs = workflow.budget.value;
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
    const report = {
      timestamp: new Date().toISOString(),
      workflowId: workflow.id,
      environment: 'headless Chromium shared/reference runner; not a certified reference device',
      fixtureContract: authority.fixtureContract,
      evidenceFixture: workflow.evidenceFixture,
      measuredObjectCounts: result.counts,
      timeToFirstFrameMs: result.timeToFirstFrameMs,
      targetMs,
      targetEnvironmentClass: workflow.budget.environmentClass,
      meetsReferenceTarget: result.timeToFirstFrameMs < targetMs,
      enforcement: workflow.enforcement,
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
