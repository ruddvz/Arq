#!/usr/bin/env node
/**
 * ARQ-116: benchmark PixiJS WebGL.
 *
 * Drives packages/plan-renderer/benchmarks/pixijs-webgl/pixijs-webgl-benchmark.html
 * in real headless Chromium (Playwright), injecting PixiJS's prebuilt
 * UMD bundle directly from node_modules (no vendored copy committed to
 * the repo) via page.addScriptTag, then reads back the same
 * frame-timing result shape run-canvas-2d-benchmark.mjs (ARQ-115)
 * produces, for direct comparison against benchmarks/PERFORMANCE-BUDGETS.json's
 * panZoomFpsTarget.
 *
 * Usage: node scripts/run-pixijs-webgl-benchmark.mjs
 */

import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(
  repoRoot,
  'packages/plan-renderer/benchmarks/pixijs-webgl/pixijs-webgl-benchmark.html',
);
const budgetsPath = path.join(repoRoot, 'benchmarks/PERFORMANCE-BUDGETS.json');
// pixi.js's package.json "exports" map only exposes the ESM entry point
// (lib/index.js), not a subpath for the prebuilt UMD bundle under dist/ -
// walk up from the resolved entry to find the package root (the
// directory whose own package.json declares "name": "pixi.js").
let pixiPackageRoot = path.dirname(require.resolve('pixi.js'));
function isPixiPackageRoot(dir) {
  const packageJsonPath = path.join(dir, 'package.json');
  return existsSync(packageJsonPath) && JSON.parse(readFileSync(packageJsonPath, 'utf8')).name === 'pixi.js';
}
while (pixiPackageRoot !== path.dirname(pixiPackageRoot) && !isPixiPackageRoot(pixiPackageRoot)) {
  pixiPackageRoot = path.dirname(pixiPackageRoot);
}
const pixiUmdPath = path.join(pixiPackageRoot, 'dist/pixi.min.js');

async function main() {
  const budgets = JSON.parse(readFileSync(budgetsPath, 'utf8'));

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    headless: true,
    args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`);
    await page.addScriptTag({ path: pixiUmdPath });
    const result = await page.evaluate(() => window.runArqPixiBenchmark());

    const report = {
      timestamp: new Date().toISOString(),
      environment:
        'headless Chromium, software WebGL (SwiftShader) in a sandboxed container (not a certified benchmark device - see docs/research/RENDERER-BENCHMARK-PIXIJS-WEBGL.md)',
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
    const outPath = path.join(
      outDir,
      `pixijs-webgl-${report.timestamp.replace(/[:.]/g, '-')}.json`,
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
