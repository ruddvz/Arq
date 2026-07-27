#!/usr/bin/env node
/**
 * ARQ-117: evaluate CanvasKit fallback.
 *
 * Drives packages/plan-renderer/benchmarks/canvaskit/canvaskit-benchmark.html
 * in real headless Chromium (Playwright), reading the same
 * frame-timing result shape as ARQ-115/116's benchmarks for a direct
 * comparison against benchmarks/PERFORMANCE-BUDGETS.json's
 * panZoomFpsTarget.
 *
 * CanvasKit needs its .wasm binary and an actual font (it does not use
 * system/browser fonts) served over http(s), not file:// (relative
 * fetches from file:// pages are unreliable in Chromium) - this script
 * runs a tiny static file server for the duration of the benchmark:
 *   /scene/  -> the shared scene generator (canvas-2d/scene.js, ARQ-115)
 *   /ck/     -> canvaskit-wasm's prebuilt bin/ directory (not vendored
 *               into the repo)
 *   /bench/  -> this issue's own benchmark html
 * The font itself is read directly from this container's installed
 * DejaVu Sans (/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf,
 * Bitstream Vera/Arev licence, freely redistributable) - also not
 * vendored into the repo, the same "environment-provided asset" stance
 * already taken for Chromium/Playwright.
 *
 * Usage: node scripts/run-canvaskit-benchmark.mjs
 */

import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
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

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const budgetsPath = path.join(repoRoot, 'benchmarks/PERFORMANCE-BUDGETS.json');

const benchDir = path.join(repoRoot, 'packages/plan-renderer/benchmarks/canvaskit');
const sceneDir = path.join(repoRoot, 'packages/plan-renderer/benchmarks/canvas-2d');

const ckPackageRoot = path.dirname(require.resolve('canvaskit-wasm/package.json'));
const ckDir = path.join(ckPackageRoot, 'bin');

const FONT_PATH = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
if (!existsSync(FONT_PATH)) {
  console.error(`Required system font not found: ${FONT_PATH}`);
  process.exitCode = 1;
  process.exit();
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
};

function serveDir(rootDir, urlPrefix) {
  return (req, res) => {
    if (!req.url.startsWith(urlPrefix)) {
      return false;
    }
    const relative = req.url.slice(urlPrefix.length).split('?')[0];
    const filePath = path.join(rootDir, relative);
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end();
      return true;
    }
    try {
      const contents = readFileSync(filePath);
      const ext = path.extname(filePath);
      res.writeHead(200, { 'content-type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(contents);
    } catch {
      res.writeHead(404);
      res.end();
    }
    return true;
  };
}

async function main() {
  const budgets = JSON.parse(readFileSync(budgetsPath, 'utf8'));

  const handlers = [
    serveDir(benchDir, '/bench/'),
    serveDir(sceneDir, '/scene/'),
    serveDir(ckDir, '/ck/'),
    serveDir('/usr/share/fonts/truetype/dejavu', '/font/'),
  ];
  const server = createServer((req, res) => {
    for (const handler of handlers) {
      if (handler(req, res)) return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/bench/canvaskit-benchmark.html`);
    const result = await page.evaluate(
      (fontUrl) => window.runArqCanvasKitBenchmark(fontUrl),
      `http://127.0.0.1:${port}/font/DejaVuSans.ttf`,
    );

    const report = {
      timestamp: new Date().toISOString(),
      environment:
        'headless Chromium, CanvasKit MakeSWCanvasSurface (Skia software rasteriser, no WebGL) in a sandboxed container - see docs/research/RENDERER-BENCHMARK-CANVASKIT.md',
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
    const outPath = path.join(outDir, `canvaskit-${report.timestamp.replace(/[:.]/g, '-')}.json`);
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nSaved to ${path.relative(repoRoot, outPath)}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
