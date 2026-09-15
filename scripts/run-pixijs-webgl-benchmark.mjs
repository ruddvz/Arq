#!/usr/bin/env node
/** ARQ-116 PixiJS WebGL reference benchmark, consuming #402 authority. */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getWorkflow, readPerformanceAuthority } from './lib/performance-authority.mjs';

function resolveChromiumExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined;
}

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(repoRoot, 'packages/plan-renderer/benchmarks/pixijs-webgl/pixijs-webgl-benchmark.html');
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
  const authority = readPerformanceAuthority();
  const workflow = getWorkflow(authority, 'plan.pan-zoom');
  const targetFps = workflow.budget.value;
  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
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
      workflowId: workflow.id,
      renderer: 'pixijs-webgl',
      environment: 'headless Chromium software WebGL (SwiftShader); reference evidence only',
      fixture: authority.fixture,
      measuredObjectCounts: result.counts,
      frameCount: result.frameCount,
      avgFrameMs: result.avgFrameMs,
      avgFps: result.avgFps,
      p95FrameMs: result.p95FrameMs,
      maxFrameMs: result.maxFrameMs,
      targetFps,
      targetEnvironmentClass: workflow.budget.environmentClass,
      meetsReferenceTarget: result.avgFps >= targetFps,
    };
    console.log(JSON.stringify(report, null, 2));
    const outDir = path.join(repoRoot, 'benchmarks/results');
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `pixijs-webgl-${report.timestamp.replace(/[:.]/g, '-')}.json`);
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
