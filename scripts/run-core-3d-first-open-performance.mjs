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
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  aggregateSamples,
  buildDiagnosticRecord,
  getWorkflow,
  readPerformanceAuthority,
  repoRoot,
} from './lib/performance-authority.mjs';
import {
  browserEnvironment,
  createCoreWorkflowFixture,
  ensureProductionWebBuild,
  openCoreWorkflowProject,
  repositorySha,
  resolveChromiumExecutablePath,
  startProductionWebServer,
  validateRenderedWebglCanvas,
} from './lib/core-product-performance.mjs';

const outDir = path.join(repoRoot, 'benchmarks/results');

async function measure3dFirstOpen(browser, origin, fixturePath) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 900 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  try {
    await openCoreWorkflowProject(page, origin, fixturePath);

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
        interactionLatencyMs: state.firstVisible - state.start,
        settledMs: state.settled - state.start,
        chunkLoadMs: chunk?.duration ?? null,
        mainThreadLongTaskCount: longTasks.length,
        mainThreadLongTaskTotalMs: longTasks.reduce((sum, entry) => sum + entry.duration, 0),
      };
    });

    // Validation happens after `settledMs` is captured so screenshot/decode cost
    // cannot make the product look slower, while a blank or dead surface still
    // invalidates the sample entirely.
    const { surface, pixels } = await validateRenderedWebglCanvas(
      page,
      modelCanvas,
      '3D first-open sample',
    );
    if (browserErrors.length > 0) {
      throw new Error(`3D first-open sample emitted browser errors (${browserErrors.length}).`);
    }

    return {
      ...measured,
      renderedUniqueColors: pixels.uniqueColors,
      canvasWidth: pixels.width,
      canvasHeight: pixels.height,
      webgl2Active: surface.isWebgl2Context,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  ensureProductionWebBuild();
  const authority = readPerformanceAuthority();
  const workflow = getWorkflow(authority, '3d.first-open');
  const fixtureId = authority.fixtureContract?.id;
  if (authority.fixtureContract?.productExecutable !== true || !fixtureId) {
    throw new Error('3D Core E2E evidence requires the product-executable Core fixture authority.');
  }

  const fixture = createCoreWorkflowFixture('3d-first-open');
  const server = await startProductionWebServer();
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
      samples.push(await measure3dFirstOpen(browser, origin, fixture.fixturePath));
    }

    const numeric = (key) =>
      samples.flatMap((sample) => (typeof sample[key] === 'number' ? [sample[key]] : []));
    const environment = browserEnvironment(browser);
    const report = buildDiagnosticRecord({
      workflowId: workflow.id,
      subsystem: workflow.owner,
      fixtureId,
      repositorySha: repositorySha(),
      coldOrWarm: 'cold-new-browser-context-per-sample',
      environment,
      samples,
      aggregates: {
        interactionLatencyMs: aggregateSamples(numeric('interactionLatencyMs')),
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
    fixture.cleanup();
  }
}

await main();
