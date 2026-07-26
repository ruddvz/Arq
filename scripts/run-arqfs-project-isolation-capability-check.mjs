#!/usr/bin/env node
/**
 * ARQ-196/220: proves project-scoped OPFS filenames actually isolate two projects
 * in a real browser, not just in a Node-level unit test of the filename-derivation
 * function. Before this fix, arqfs-worker-entry.ts opened every project through the
 * same fixed OPFS filename - a real, silent cross-project data collision, since
 * OPFS storage is shared at the origin, not per-Worker.
 *
 * Drives workers/arqfs-worker/benchmarks/project-isolation.html in real headless
 * Chromium (Playwright): writes a distinct value to two different project ids,
 * reloads the page (destroys all in-memory JS state, not just Worker teardown),
 * then reads both projects back and asserts each sees only its own value.
 *
 * Usage: node scripts/run-arqfs-project-isolation-capability-check.mjs
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

const benchDir = path.join(repoRoot, 'workers/arqfs-worker/benchmarks');
const sqliteWasmDir = path.dirname(
  require.resolve('@sqlite.org/sqlite-wasm/package.json', {
    paths: [path.join(repoRoot, 'workers/arqfs-worker')],
  }),
);
const sqliteWasmDistDir = path.join(sqliteWasmDir, 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
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

function startServer() {
  const handlers = [serveDir(benchDir, '/bench/'), serveDir(sqliteWasmDistDir, '/sqlite-wasm/')];
  const server = createServer((req, res) => {
    for (const handler of handlers) {
      if (handler(req, res)) return;
    }
    res.writeHead(404);
    res.end();
  });
  return server;
}

async function run() {
  const server = startServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    await page.goto(`http://127.0.0.1:${port}/bench/project-isolation.html`);
    await page.waitForFunction(() => window.__ARQ_ARQFS_ISOLATION_READY__ === true, {
      timeout: 10_000,
    });

    const writeA = await page.evaluate(
      ([id, value]) => window.__arqfsIsolationWrite(id, value),
      ['project-a', 'value-belongs-to-project-a'],
    );
    if (!writeA.ok) return { stage: 'write-a', ok: false, error: writeA.error, consoleErrors };

    const writeB = await page.evaluate(
      ([id, value]) => window.__arqfsIsolationWrite(id, value),
      ['project-b', 'value-belongs-to-project-b'],
    );
    if (!writeB.ok) return { stage: 'write-b', ok: false, error: writeB.error, consoleErrors };

    // Full navigation between the writes and the reads: a successful, correctly
    // isolated read-back below can only be explained by real per-project OPFS
    // files, not by anything retained in page memory.
    await page.reload();
    await page.waitForFunction(() => window.__ARQ_ARQFS_ISOLATION_READY__ === true, {
      timeout: 10_000,
    });

    const readA = await page.evaluate((id) => window.__arqfsIsolationRead(id), 'project-a');
    if (!readA.ok) return { stage: 'read-a', ok: false, error: readA.error, consoleErrors };

    const readB = await page.evaluate((id) => window.__arqfsIsolationRead(id), 'project-b');
    if (!readB.ok) return { stage: 'read-b', ok: false, error: readB.error, consoleErrors };

    const projectASawOnlyItsOwnValue =
      readA.rows.length === 1 && readA.rows[0].value === 'value-belongs-to-project-a';
    const projectBSawOnlyItsOwnValue =
      readB.rows.length === 1 && readB.rows[0].value === 'value-belongs-to-project-b';
    const noCrossContamination =
      projectASawOnlyItsOwnValue &&
      projectBSawOnlyItsOwnValue &&
      !readA.rows.some((row) => row.value === 'value-belongs-to-project-b') &&
      !readB.rows.some((row) => row.value === 'value-belongs-to-project-a');

    return {
      ok: noCrossContamination,
      libVersion: writeA.libVersion,
      readA: readA.rows,
      readB: readB.rows,
      projectASawOnlyItsOwnValue,
      projectBSawOnlyItsOwnValue,
      noCrossContamination,
      consoleErrors,
    };
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  const version = (
    await (async () => {
      const b = await chromium.launch({
        executablePath: resolveChromiumExecutablePath(),
        headless: true,
      });
      const v = await b.version();
      await b.close();
      return v;
    })()
  ).toString();

  const result = await run();

  const report = {
    timestamp: new Date().toISOString(),
    environment: `headless Chromium ${version}, sandboxed container - real sqlite-wasm + OPFS, two projects opened through project-scoped filenames exactly as arqfs-worker-entry.ts derives them`,
    ...result,
  };

  console.log(JSON.stringify(report, null, 2));

  const outDir = path.join(repoRoot, 'benchmarks/results');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `arqfs-project-isolation-capability-${report.timestamp.replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nSaved to ${path.relative(repoRoot, outPath)}`);

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
