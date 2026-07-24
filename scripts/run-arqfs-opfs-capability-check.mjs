#!/usr/bin/env node
/**
 * ARQ-196/219: implement/benchmark the sqlite-wasm-opfs prototype.
 *
 * Drives workers/arqfs-worker/benchmarks/opfs-capability.html in real headless
 * Chromium (Playwright) - real sqlite-wasm + OPFS behaviour in this sandboxed
 * container, not an assumption from documentation. Runs write -> full page reload ->
 * read to prove real persistence across worker teardown AND page navigation, not
 * just JS variable retention. Also empirically checks whether opfs-sahpool actually
 * needs the Cross-Origin-Opener-Policy/Cross-Origin-Embedder-Policy headers the
 * package's own README warns about for OPFS in general, by running once without
 * them and (only if that fails) once with them - see docs/research/
 * ARQFS-OPFS-CAPABILITY.md for the resulting finding.
 *
 * Usage: node scripts/run-arqfs-opfs-capability-check.mjs
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
// @sqlite.org/sqlite-wasm is a dependency of workers/arqfs-worker specifically (not
// hoisted to the repo root under pnpm's isolated node_modules layout), so resolve it
// from that package's own directory rather than assuming root-level access.
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

function startServer({ crossOriginIsolated }) {
  const handlers = [serveDir(benchDir, '/bench/'), serveDir(sqliteWasmDistDir, '/sqlite-wasm/')];
  const server = createServer((req, res) => {
    if (crossOriginIsolated) {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    }
    for (const handler of handlers) {
      if (handler(req, res)) return;
    }
    res.writeHead(404);
    res.end();
  });
  return server;
}

async function runOnce({ crossOriginIsolated }) {
  const server = startServer({ crossOriginIsolated });
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
    await page.goto(`http://127.0.0.1:${port}/bench/opfs-capability.html`);
    await page.waitForFunction(() => window.__ARQ_ARQFS_CAPABILITY_READY__ === true, {
      timeout: 10_000,
    });

    const writeResult = await page.evaluate((value) => window.__arqfsWrite(value), 'first-write');
    if (!writeResult.ok) {
      return {
        crossOriginIsolated,
        stage: 'write',
        ok: false,
        error: writeResult.error,
        consoleErrors,
      };
    }

    // Full navigation, not just worker.terminate(): destroys every piece of page-level
    // JS state, so a successful read-back below can only be explained by real OPFS
    // persistence, not by anything retained in memory.
    await page.reload();
    await page.waitForFunction(() => window.__ARQ_ARQFS_CAPABILITY_READY__ === true, {
      timeout: 10_000,
    });
    const readResult = await page.evaluate(() => window.__arqfsRead());
    if (!readResult.ok) {
      return {
        crossOriginIsolated,
        stage: 'read-after-reload',
        ok: false,
        error: readResult.error,
        consoleErrors,
      };
    }

    const persistedAcrossReload =
      readResult.tableExists &&
      readResult.rows.length === writeResult.rows.length &&
      readResult.rows.every((row, i) => row.value === writeResult.rows[i].value);

    return {
      crossOriginIsolated,
      ok: true,
      usedVfs: writeResult.usedVfs,
      libVersion: writeResult.libVersion,
      writeRows: writeResult.rows,
      readRowsAfterReload: readResult.rows,
      persistedAcrossReload,
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

  let result = await runOnce({ crossOriginIsolated: false });
  if (!result.ok) {
    console.log('Without COOP/COEP headers, opfs-sahpool failed - retrying with them:');
    console.log(JSON.stringify(result, null, 2));
    result = await runOnce({ crossOriginIsolated: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    environment: `headless Chromium ${version}, sandboxed container - real sqlite-wasm + OPFS, not a physical device (see docs/research/ARQFS-OPFS-CAPABILITY.md)`,
    ...result,
  };

  console.log(JSON.stringify(report, null, 2));

  const outDir = path.join(repoRoot, 'benchmarks/results');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `arqfs-opfs-capability-${report.timestamp.replace(/[:.]/g, '-')}.json`,
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
