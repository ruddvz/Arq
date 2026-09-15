#!/usr/bin/env node
/**
 * Measures protected-scene Canvas 2D pan/zoom frame timing in real Chromium.
 * Product target and CI regression policy are owned by #402's canonical file.
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
  const workflow = getWorkflow(authority, 'plan.pan-zoom');
  const targetFps = workflow.budget.value;
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
      frameCount: result.frameCount,
      avgFrameMs: result.avgFrameMs,
      avgFps: result.avgFps,
      p95FrameMs: result.p95FrameMs,
      maxFrameMs: result.maxFrameMs,
      targetFps,
      targetEnvironmentClass: workflow.budget.environmentClass,
      meetsReferenceTarget: result.avgFps >= targetFps,
      ciRegressionBaseline: workflow.regression,
      enforcement: workflow.enforcement,
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
