#!/usr/bin/env node
/**
 * ARQ-204: real headless-Chromium check that the wasm-bindgen `--target web`
 * build of rust/arq-core loads and runs correctly inside a genuine dedicated Worker
 * (ESM import + init), not just Node's WASM support (scripts/
 * verify-arq-core-wasm-parity.mjs already covers the Node path - this is the
 * different, real-browser-Worker code path ADR-0020 actually asks for).
 *
 * Requires rust/arq-core/pkg/ to exist (node scripts/build-arq-core-wasm.mjs).
 *
 * Usage: node scripts/run-arq-core-worker-capability-check.mjs
 */

import { chromium } from 'playwright';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const benchDir = path.join(repoRoot, 'rust/arq-core/benchmarks');
const pkgDir = path.join(repoRoot, 'rust/arq-core/pkg');

if (!existsSync(path.join(pkgDir, 'arq_core.js'))) {
  console.error(
    `${path.relative(repoRoot, pkgDir)} does not exist - run: node scripts/build-arq-core-wasm.mjs`,
  );
  process.exitCode = 1;
  process.exit();
}

const MIME_TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm' };

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
  const handlers = [serveDir(benchDir, '/bench/'), serveDir(pkgDir, '/pkg/')];
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
    await page.goto(`http://127.0.0.1:${port}/bench/arq-core-worker-capability.html`);
    await page.waitForFunction(() => window.__ARQ_CORE_WORKER_RESULT__ !== undefined, {
      timeout: 10_000,
    });
    const result = await page.evaluate(() => window.__ARQ_CORE_WORKER_RESULT__);
    const version = await browser.version();

    const report = {
      timestamp: new Date().toISOString(),
      environment: `headless Chromium ${version}, real dedicated Worker loading the wasm-bindgen --target web build via ESM import`,
      ...result,
    };
    console.log(JSON.stringify(report, null, 2));

    const outDir = path.join(repoRoot, 'benchmarks/results');
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(
      outDir,
      `arq-core-worker-capability-${report.timestamp.replace(/[:.]/g, '-')}.json`,
    );
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nSaved to ${path.relative(repoRoot, outPath)}`);

    if (!result.ok) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
