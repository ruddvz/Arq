#!/usr/bin/env node
/** ARQ-117 CanvasKit reference benchmark, consuming #402 authority. */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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
    if (!req.url.startsWith(urlPrefix)) return false;
    const relative = req.url.slice(urlPrefix.length).split('?')[0];
    const filePath = path.join(rootDir, relative);
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end();
      return true;
    }
    try {
      const contents = readFileSync(filePath);
      res.writeHead(200, {
        'content-type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      });
      res.end(contents);
    } catch {
      res.writeHead(404);
      res.end();
    }
    return true;
  };
}

async function main() {
  const authority = readPerformanceAuthority();
  const workflow = getWorkflow(authority, 'plan.pan-zoom');
  const targetFps = workflow.budget.value;
  const handlers = [
    serveDir(benchDir, '/bench/'),
    serveDir(sceneDir, '/scene/'),
    serveDir(ckDir, '/ck/'),
    serveDir('/usr/share/fonts/truetype/dejavu', '/font/'),
  ];
  const server = createServer((req, res) => {
    for (const handler of handlers) if (handler(req, res)) return;
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
      workflowId: workflow.id,
      renderer: 'canvaskit-software',
      environment: 'headless Chromium CanvasKit software rasteriser; reference evidence only',
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
