#!/usr/bin/env node
/**
 * #402 scheduled/reference measurement for `3d.first-open` on the protected
 * product-executable Core fixture.
 *
 * Project opening is setup only. #361 still owns open/adopt authority, so this
 * script does not turn setup time into `project.open-adopt` evidence. The timed
 * window starts from the trusted click on the real 3D tab and ends after the 3D
 * canvas is visible and two animation frames have completed. Render validity is
 * then proved outside the timed window through the live WebGL2 context and
 * composited screenshot pixels, preventing a blank/failed canvas from passing
 * because it happened to become visible quickly.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { cpus, platform, arch, release, tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {
  aggregateSamples,
  buildDiagnosticRecord,
  getWorkflow,
  readPerformanceAuthority,
  repoRoot,
} from './lib/performance-authority.mjs';

const distDir = path.join(repoRoot, 'apps/web/dist');
const outDir = path.join(repoRoot, 'benchmarks/results');
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

function resolveChromiumExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined;
}

function repositorySha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function startServer() {
  const server = createServer((request, response) => {
    const requested = (request.url ?? '/').split('?')[0];
    let filePath = path.join(distDir, decodeURIComponent(requested));
    if (!filePath.startsWith(distDir)) {
      response.writeHead(403).end();
      return;
    }
    if (!existsSync(filePath) || !path.extname(filePath)) {
      filePath = path.join(distDir, 'index.html');
    }
    response.setHeader(
      'Content-Type',
      MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
    );
    response.end(readFileSync(filePath));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/**
 * Plain Node cannot import the repository TypeScript package graph directly.
 * Use the same short-lived Vitest bridge already established by the file-open
 * capability check, but call the single canonical Core fixture generator rather
 * than duplicating fixture construction here.
 */
function writeCoreFixture(directory) {
  const fixturePath = path.join(directory, 'core-workflow.arq');
  const generatedTest = path.join(repoRoot, 'scripts/_core-3d-fixture.generated.test.ts');
  const escapedFixturePath = fixturePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  writeFileSync(
    generatedTest,
    `import { it } from 'vitest';\nimport { writeCoreWorkflowArqFile } from '../benchmarks/fixtures/core-workflow-product-fixture';\n\nit('writes the canonical Core workflow fixture for the 3D performance probe', async () => {\n  await writeCoreWorkflowArqFile('${escapedFixturePath}');\n});\n`,
  );
  try {
    execFileSync('npx', ['vitest', 'run', generatedTest, '--coverage=false'], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
  } finally {
    rmSync(generatedTest, { force: true });
  }
  if (!existsSync(fixturePath)) throw new Error('Core fixture generator did not produce its .arq file.');
  return fixturePath;
}

async function analyzeCanvasPixels(page, pngBuffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const scratch = document.createElement('canvas');
    scratch.width = image.naturalWidth;
    scratch.height = image.naturalHeight;
    const context = scratch.getContext('2d');
    if (context === null) throw new Error('screenshot decoder refused a 2D context');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, scratch.width, scratch.height).data;
    const colors = new Set();
    for (let index = 0; index < pixels.length; index += 4) {
      colors.add((pixels[index] << 16) | (pixels[index + 1] << 8) | pixels[index + 2]);
      if (colors.size > 8) break;
    }
    return { uniqueColors: colors.size, width: scratch.width, height: scratch.height };
  }, pngBuffer.toString('base64'));
}

async function measure3dFirstOpen(browser, origin, fixturePath) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 900 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  try {
    await page.goto(origin, { waitUntil: 'load' });
    await page.waitForSelector('.arq-shell-button', { state: 'visible', timeout: 30_000 });
    await page.getByRole('button', { name: 'Open' }).click();
    const dialog = page.getByRole('dialog', { name: 'Open project' });
    await dialog.waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator('input[type="file"]').setInputFiles(fixturePath);

    const projectNameControl = page.getByRole('button', {
      name: /^Project name: Synthetic Core Workflow Project\./,
    });
    await projectNameControl.waitFor({ state: 'visible', timeout: 30_000 });
    await dialog.waitFor({ state: 'hidden', timeout: 10_000 });

    const tab3d = page.getByRole('tab', { name: /3D/ });
    await tab3d.waitFor({ state: 'visible', timeout: 10_000 });
    await tab3d.evaluate((element) => {
      performance.clearResourceTimings();
      const state = {
        start: null,
        firstVisible: null,
        settled: null,
        longTasks: [],
      };
      window.__ARQ_PERF_3D_FIRST_OPEN__ = state;
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              state.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
            }
          });
          observer.observe({ type: 'longtask', buffered: true });
        } catch {
          // Long Tasks are optional evidence; absence is recorded as zero rather than fabricated.
        }
      }
      element.addEventListener(
        'click',
        () => {
          state.start = performance.now();
          const observeFrame = () => {
            const canvas = document.querySelector('canvas[aria-label="3D model view"]');
            const visible =
              canvas !== null &&
              canvas.clientWidth > 0 &&
              canvas.clientHeight > 0 &&
              getComputedStyle(canvas).visibility !== 'hidden';
            if (visible && state.firstVisible === null) {
              state.firstVisible = performance.now();
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  state.settled = performance.now();
                });
              });
              return;
            }
            requestAnimationFrame(observeFrame);
          };
          requestAnimationFrame(observeFrame);
        },
        { capture: true, once: true },
      );
    });

    await tab3d.click();
    await page.waitForFunction(
      () => window.__ARQ_PERF_3D_FIRST_OPEN__?.settled !== null,
      undefined,
      { timeout: 30_000 },
    );

    const modelCanvas = page.locator('canvas[aria-label="3D model view"]');
    await modelCanvas.waitFor({ state: 'visible', timeout: 10_000 });
    const measured = await page.evaluate(() => {
      const state = window.__ARQ_PERF_3D_FIRST_OPEN__;
      const end = state.settled;
      const longTasks = state.longTasks.filter(
        (entry) => entry.startTime >= state.start && entry.startTime <= end,
      );
      const chunk = performance
        .getEntriesByType('resource')
        .find((entry) => /\/ModelCanvas-[^/]+\.js(?:$|\?)/.test(entry.name));
      return {
        firstVisibleMs: state.firstVisible - state.start,
        settledMs: state.settled - state.start,
        chunkLoadMs: chunk?.duration ?? null,
        mainThreadLongTaskCount: longTasks.length,
        mainThreadLongTaskTotalMs: longTasks.reduce((sum, entry) => sum + entry.duration, 0),
      };
    });

    // Validation happens after `settledMs` is captured so screenshot/decode cost
    // cannot make the product look slower, while a blank or dead surface still
    // invalidates the sample entirely.
    const surface = await modelCanvas.evaluate((canvas) => ({
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
      is2dContext: canvas.getContext('2d') !== null,
      isWebgl2Context: canvas.getContext('webgl2') !== null,
    }));
    const pixels = await analyzeCanvasPixels(page, await modelCanvas.screenshot());
    if (
      surface.clientWidth <= 0 ||
      surface.clientHeight <= 0 ||
      surface.is2dContext ||
      !surface.isWebgl2Context ||
      pixels.uniqueColors <= 1
    ) {
      throw new Error('3D first-open sample reached timing completion without a valid rendered WebGL2 frame.');
    }
    if (browserErrors.length > 0) {
      throw new Error(`3D first-open sample emitted browser errors (${browserErrors.length}).`);
    }

    return {
      ...measured,
      renderedUniqueColors: pixels.uniqueColors,
      canvasWidth: pixels.width,
      canvasHeight: pixels.height,
      webgl2Active: true,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('apps/web/dist is absent. Run the production web build before this benchmark.');
  }

  const authority = readPerformanceAuthority();
  const workflow = getWorkflow(authority, '3d.first-open');
  const fixtureId = authority.fixtureContract?.id;
  if (authority.fixtureContract?.productExecutable !== true || !fixtureId) {
    throw new Error('3D Core E2E evidence requires the product-executable Core fixture authority.');
  }

  const fixtureDirectory = mkdtempSync(path.join(tmpdir(), 'arq-core-3d-performance-'));
  const fixturePath = writeCoreFixture(fixtureDirectory);
  const server = await startServer();
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });

  try {
    const sampleCount = Math.max(authority.regressionPolicy.minimumSamplesForAcceptedTiming, 7);
    const samples = [];
    for (let index = 0; index < sampleCount; index += 1) {
      samples.push(await measure3dFirstOpen(browser, origin, fixturePath));
    }

    const numeric = (key) => samples.flatMap((sample) =>
      typeof sample[key] === 'number' ? [sample[key]] : [],
    );
    const environment = {
      browser: `Chromium ${browser.version()}`,
      engine: 'Chromium',
      os: `${platform()} ${release()} ${arch()}`,
      cpuModel: cpus()[0]?.model ?? 'unknown',
      logicalCpuCount: cpus().length,
      runner: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
      nodeVersion: process.version,
    };
    const report = buildDiagnosticRecord({
      workflowId: workflow.id,
      subsystem: workflow.owner,
      fixtureId,
      repositorySha: repositorySha(),
      coldOrWarm: 'cold-new-browser-context-per-sample',
      environment,
      samples,
      aggregates: {
        firstVisibleMs: aggregateSamples(numeric('firstVisibleMs')),
        settledMs: aggregateSamples(numeric('settledMs')),
        chunkLoadMs: aggregateSamples(numeric('chunkLoadMs')),
        mainThreadLongTaskTotalMs: aggregateSamples(numeric('mainThreadLongTaskTotalMs')),
      },
      counters: {
        sampleCount: samples.length,
        totalLongTasks: samples.reduce((sum, sample) => sum + sample.mainThreadLongTaskCount, 0),
        renderedSamples: samples.filter((sample) => sample.webgl2Active === true).length,
      },
      bottleneckClasses: ['deferred-chunk', 'main-thread', 'rendering'],
    });

    mkdirSync(outDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(outDir, `core-workflow-3d-first-open-${timestamp}.json`);
    writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      JSON.stringify(
        { file: path.relative(repoRoot, file), aggregates: report.aggregates, environment },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
    server.close();
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
}

await main();
