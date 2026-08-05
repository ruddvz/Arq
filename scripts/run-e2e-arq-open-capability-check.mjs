#!/usr/bin/env node
/**
 * ARQ-217: the browser Worker and OPFS project-opening proof that
 * `e2e_arq_open` recorded as a proof gap.
 *
 * What makes this an end-to-end check rather than another library test: the
 * Worker it drives is a bundle of the REAL `workers/arqfs-worker/src/arqfs-worker-entry.ts`,
 * which imports the real `handleArqfsWorkerRequest` from `@arq/arqfs`. The two
 * existing OPFS checks in this directory deliberately reimplement the mechanism
 * under test in throwaway JS because no bundler was wired for them; a
 * reimplementation cannot prove the shipped open path behaves correctly, so this
 * one bundles the actual module with Vite (already a dependency - no new
 * package, no lockfile change) and serves that.
 *
 * Four outcomes, each on its own project id so one case cannot contaminate the
 * next, and each opened by a freshly constructed Worker so the file has to
 * survive Worker teardown in real OPFS:
 *
 *   valid      - a project this build wrote: opened, readable and writable
 *   read-only  - min_writer_major above this reader: opened, readable, not writable
 *   old-reader - min_reader_major above this reader: opened but canRead false and
 *                safeModeRequired true, which is where this build carries that
 *                refusal rather than in a 'rejected' status
 *   foreign    - valid SQLite, non-zero application_id, no arqfs_meta: rejected
 *
 * The seeded cases are also the persistence proof: the seeded floor only reaches
 * the open under test if the file survived Worker teardown in real OPFS. Had it
 * not, the fresh Worker would have initialised a new schema and reported the
 * 'valid' outcome, so those cases fail rather than silently passing.
 *
 * What this check does NOT establish: that `apps/web` reaches this path from a
 * file someone chose, or that the decoded project arrives in the workspace. It
 * drives the Worker directly, so it would keep passing if the UI were wired to
 * nothing at all. `benchmark:file-open` is the check that makes that claim, by
 * driving the real interface.
 *
 * Usage: node scripts/run-e2e-arq-open-capability-check.mjs
 */

import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

/**
 * `/opt/pw-browsers/chromium` is this development sandbox's pre-installed
 * browser; a plain CI runner installs to Playwright's own cache instead.
 * Falling back to `undefined` lets Playwright resolve it there.
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
const workerEntry = path.join(repoRoot, 'workers/arqfs-worker/src/arqfs-worker-entry.ts');
const bundleDir = path.join(repoRoot, 'workers/arqfs-worker/.e2e-open-bundle');
const sqliteWasmDistDir = path.join(
  path.dirname(
    require.resolve('@sqlite.org/sqlite-wasm/package.json', {
      paths: [path.join(repoRoot, 'workers/arqfs-worker')],
    }),
  ),
  'dist',
);

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
};

const SQLITE_WASM_SPECIFIER = '@sqlite.org/sqlite-wasm';
const SERVED_SQLITE_WASM = '/sqlite-wasm/index.mjs';

/**
 * sqlite-wasm stays external and is rewritten to the served copy the page
 * already exposes. Bundling it would relocate the `.wasm` it fetches relative
 * to itself, which is the one part of this stack that must stay exactly as the
 * real Worker loads it.
 */
async function bundleRealWorker() {
  // Vite is `apps/web`'s devDependency, so it is linked there rather than at the
  // repository root. Resolving from that package uses the build tool this
  // repository already installs instead of adding one for this check.
  const viteModule = await import(
    pathToFileURL(require.resolve('vite', { paths: [path.join(repoRoot, 'apps/web')] })).href
  );
  // `require.resolve` lands on Vite's CJS entry, which arrives here wrapped in
  // `default` rather than as named exports.
  const build = viteModule.build ?? viteModule.default?.build;
  if (typeof build !== 'function') throw new Error('could not load Vite build API');
  rmSync(bundleDir, { recursive: true, force: true });
  await build({
    root: repoRoot,
    logLevel: 'error',
    build: {
      outDir: bundleDir,
      emptyOutDir: true,
      target: 'esnext',
      minify: false,
      lib: { entry: workerEntry, formats: ['es'], fileName: () => 'e2e-arq-open-worker.js' },
      rollupOptions: { external: [SQLITE_WASM_SPECIFIER] },
    },
  });
  const bundlePath = path.join(bundleDir, 'e2e-arq-open-worker.js');
  const bundled = readFileSync(bundlePath, 'utf8');
  if (!bundled.includes(SQLITE_WASM_SPECIFIER)) {
    throw new Error(
      'bundled worker no longer imports ' +
        SQLITE_WASM_SPECIFIER +
        ' - the external/rewrite assumption in this script is stale',
    );
  }
  writeFileSync(bundlePath, bundled.split(SQLITE_WASM_SPECIFIER).join(SERVED_SQLITE_WASM));
  return bundlePath;
}

function serveDir(rootDir, urlPrefix) {
  return (req, res) => {
    const url = req.url.split('?')[0];
    if (!url.startsWith(urlPrefix)) return false;
    const relative = url.slice(urlPrefix.length) || 'index.html';
    const filePath = path.join(rootDir, relative);
    if (!filePath.startsWith(rootDir) || !existsSync(filePath)) {
      res.writeHead(404).end('not found');
      return true;
    }
    res.writeHead(200, {
      'content-type': MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
    });
    res.end(readFileSync(filePath));
    return true;
  };
}

function startServer(unservedUrls) {
  // The bundled worker is the one path under /bench/ that does not come from the
  // benchmarks directory, so it is matched exactly before the directory handler.
  const serveBundledWorker = (req, res) => {
    if (req.url.split('?')[0] !== '/bench/e2e-arq-open-worker.js') return false;
    res.writeHead(200, { 'content-type': 'text/javascript' });
    res.end(readFileSync(path.join(bundleDir, 'e2e-arq-open-worker.js')));
    return true;
  };
  // Chromium asks for a favicon on its own. Answering it keeps "nothing went
  // unserved" a meaningful assertion instead of one permanent expected 404.
  const serveFavicon = (req, res) => {
    if (req.url.split('?')[0] !== '/favicon.ico') return false;
    res.writeHead(204).end();
    return true;
  };
  const handlers = [
    serveFavicon,
    serveBundledWorker,
    serveDir(benchDir, '/bench/'),
    serveDir(sqliteWasmDistDir, '/sqlite-wasm/'),
  ];
  const server = createServer((req, res) => {
    for (const handler of handlers) {
      if (handler(req, res) === true) return;
    }
    // Worker requests never surface on Playwright's page `response` event, so a
    // 404 fetched from inside the Worker would otherwise be an anonymous console
    // line. The server is the only place that sees every request.
    unservedUrls.push(req.url);
    res.writeHead(404).end('not found');
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exitCode = 1;
}

const CASES = [
  {
    id: 'valid',
    projectId: 'e2e-open-valid',
    describe: 'a project this build wrote opens readable and writable',
    seed: null,
    expect: (result) =>
      result.status === 'opened' &&
      result.capabilities.canRead === true &&
      result.capabilities.canWrite === true,
  },
  {
    id: 'read-only',
    projectId: 'e2e-open-read-only',
    describe: 'a file written by a newer writer opens readable but refuses writes',
    seed: { type: 'setMeta', key: 'min_writer_major', value: 9 },
    expect: (result) =>
      result.status === 'opened' &&
      result.capabilities.canRead === true &&
      result.capabilities.canWrite === false,
  },
  {
    id: 'old-reader',
    projectId: 'e2e-open-old-reader',
    describe: 'a file this reader is too old to understand refuses reads and demands safe mode',
    seed: { type: 'setMeta', key: 'min_reader_major', value: 9 },
    // The refusal is carried in the capabilities, not in an 'rejected' status:
    // the header was readable, so the file is reported with canRead false and
    // safeModeRequired true rather than as an unparseable file. Asserting
    // `status === 'rejected'` here would be asserting a behaviour this build
    // does not have.
    expect: (result) =>
      result.status === 'opened' &&
      result.capabilities.canRead === false &&
      result.capabilities.canWrite === false &&
      result.capabilities.safeModeRequired === true &&
      result.capabilities.unsupportedRequiredFeatures.includes('format-major-too-new-for-reader'),
  },
  {
    id: 'foreign',
    projectId: 'e2e-open-foreign',
    describe: 'valid SQLite that is not an Arq project is refused, not initialised over',
    seedFirst: { type: 'makeForeignSqlite', applicationId: 0x12345678 },
    expect: (result) => result.status === 'rejected',
  },
];

async function main() {
  const bundlePath = await bundleRealWorker();
  const unservedUrls = [];
  const { server, port } = await startServer(unservedUrls);
  const browser = await chromium.launch({ executablePath: resolveChromiumExecutablePath() });
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleErrors = [];
  // A bare console message says a resource 404'd without saying which, and a
  // missing sqlite-wasm asset would look identical to a missing favicon. The
  // URL is recorded so the artifact names what was not served.
  const missingResources = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on(
    'response',
    (r) => r.status() >= 400 && missingResources.push(`${r.status()} ${r.url()}`),
  );

  const observed = [];
  try {
    await page.goto(`http://127.0.0.1:${port}/bench/e2e-arq-open.html`, {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(() => window.__ARQ_E2E_OPEN_READY__ === true, { timeout: 30_000 });

    for (const testCase of CASES) {
      // A case that seeds first never lets the real Worker create a schema.
      if (testCase.seedFirst) {
        const seeded = await page.evaluate(
          ([projectId, request]) => window.__arqSeed(projectId, request),
          [testCase.projectId, testCase.seedFirst],
        );
        if (seeded.ok !== true) throw new Error(`${testCase.id} seedFirst failed: ${seeded.error}`);
      }

      // Otherwise the real Worker creates the project, then the seeder moves a
      // single version floor, then a fresh real Worker opens it again.
      if (testCase.seed) {
        const created = await page.evaluate(
          (projectId) => window.__arqOpen(projectId),
          testCase.projectId,
        );
        if (created.ok !== true || created.payload?.result?.status !== 'opened') {
          throw new Error(`${testCase.id} could not create its project to seed`);
        }
        const seeded = await page.evaluate(
          ([projectId, request]) => window.__arqSeed(projectId, request),
          [testCase.projectId, testCase.seed],
        );
        if (seeded.ok !== true) throw new Error(`${testCase.id} seed failed: ${seeded.error}`);
      }

      const response = await page.evaluate(
        (projectId) => window.__arqOpen(projectId),
        testCase.projectId,
      );
      if (response.ok !== true) throw new Error(`${testCase.id} worker error: ${response.error}`);
      const { result, usedVfs } = response.payload;
      const passed = testCase.expect(result) === true;
      observed.push({
        case: testCase.id,
        describe: testCase.describe,
        projectId: testCase.projectId,
        usedVfs,
        result,
        passed,
      });
      if (!passed) fail(`${testCase.id}: unexpected open result ${JSON.stringify(result)}`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  // An in-memory fallback would still satisfy every outcome above while proving
  // nothing about OPFS, so the VFS actually used is part of the verdict.
  const vfsUsed = [...new Set(observed.map((entry) => entry.usedVfs))];
  if (vfsUsed.length !== 1 || vfsUsed[0] !== 'opfs-sahpool') {
    fail(`expected every open to use opfs-sahpool, observed ${JSON.stringify(vfsUsed)}`);
  }
  if (consoleErrors.length > 0) fail(`console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
  const unserved = [...new Set([...missingResources, ...unservedUrls])];
  if (unserved.length > 0) fail(`unserved resources: ${unserved.join(' | ')}`);
  if (observed.length !== CASES.length) fail('not every case reported a result');

  const version = await (async () => {
    const b = await chromium.launch({ executablePath: resolveChromiumExecutablePath() });
    const v = b.version();
    await b.close();
    return v;
  })();

  const artifact = {
    evidenceId: 'e2e_arq_open',
    timestamp: new Date().toISOString(),
    environment: `headless Chromium ${version} - real sqlite-wasm over OPFS, driving a bundle of the real workers/arqfs-worker/src/arqfs-worker-entry.ts`,
    workerBundle: path.relative(repoRoot, bundlePath),
    vfsUsed,
    cases: observed,
    consoleErrors,
    unservedUrls: [...new Set([...missingResources, ...unservedUrls])],
    ok: process.exitCode !== 1,
    limitation:
      'Proves the Worker and OPFS open path for these four outcomes, driving the Worker directly. That apps/web reaches this path from a chosen file, and that the decoded project arrives in the workspace, is the separate claim benchmark:file-open makes by driving the real UI.',
  };
  const outDir = path.join(repoRoot, 'benchmarks/results');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `e2e-arq-open-capability-${artifact.timestamp.replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(outPath, JSON.stringify(artifact, null, 2) + '\n');
  rmSync(bundleDir, { recursive: true, force: true });
  console.log(JSON.stringify(artifact, null, 2));
  console.log(`Saved to ${path.relative(repoRoot, outPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
