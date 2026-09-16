#!/usr/bin/env node
/**
 * #402 scheduled/reference measurement for `wall.preview` on the product-
 * executable Core fixture.
 *
 * Opening the Core project is setup only. The benchmark never commits a wall:
 * it arms the real Wall tool, places one draft anchor, then measures a real
 * pointer move until the Wall HUD reflects the new candidate and two animation
 * frames have settled. The post-timing validation proves that the Plan canvas
 * visibly changed during preview. Escape cancels the draft, so this probe does
 * not cross native persistence/session ownership.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
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
} from './lib/core-product-performance.mjs';

const outDir = path.join(repoRoot, 'benchmarks/results');
const HUD = '[data-testid="arq-wall-hud"]';
const HUD_INPUT = '#arq-wall-length-input';

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function measureWallPreview(browser, origin, fixturePath) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 900 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  try {
    await openCoreWorkflowProject(page, origin, fixturePath);
    const planCanvas = page.locator('canvas[aria-label="Plan canvas"]');
    await planCanvas.waitFor({ state: 'visible', timeout: 10_000 });
    const box = await planCanvas.boundingBox();
    if (box === null || box.width <= 0 || box.height <= 0) {
      throw new Error('Core Plan canvas has no measurable bounds.');
    }

    await page.keyboard.press('w');
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector('canvas[aria-label="Plan canvas"]');
        return canvas !== null && getComputedStyle(canvas).cursor === 'crosshair';
      },
      undefined,
      { timeout: 5_000 },
    );

    const y = box.y + box.height * 0.45;
    const anchorX = box.x + box.width * 0.33;
    await page.mouse.move(anchorX, y);
    await page.mouse.click(anchorX, y);
    await page.mouse.move(box.x + box.width * 0.46, y);
    const hud = page.locator(HUD);
    await hud.waitFor({ state: 'visible', timeout: 5_000 });
    const input = page.locator(HUD_INPUT);
    const placeholderBefore = await input.getAttribute('placeholder');
    if (placeholderBefore === null)
      throw new Error('Wall preview HUD has no live length placeholder.');
    const canvasBeforeHash = sha256(await planCanvas.screenshot());

    await planCanvas.evaluate((canvas) => {
      const input = document.querySelector('#arq-wall-length-input');
      if (!(input instanceof HTMLInputElement)) throw new Error('Wall HUD input is unavailable.');
      const state = {
        start: null,
        firstVisible: null,
        settled: null,
        previousPlaceholder: input.getAttribute('placeholder'),
        longTasks: [],
      };
      window.__ARQ_PERF_WALL_PREVIEW__ = state;
      if ('PerformanceObserver' in window) {
        try {
          const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              state.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
            }
          });
          observer.observe({ type: 'longtask', buffered: true });
        } catch {
          // Long Tasks are optional evidence only.
        }
      }
      const mutation = new MutationObserver(() => {
        if (state.start === null || state.firstVisible !== null) return;
        const next = input.getAttribute('placeholder');
        if (next !== null && next !== state.previousPlaceholder) {
          state.firstVisible = performance.now();
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              state.settled = performance.now();
              mutation.disconnect();
            });
          });
        }
      });
      mutation.observe(input, { attributes: true, attributeFilter: ['placeholder'] });
      canvas.addEventListener(
        'pointermove',
        () => {
          if (state.start === null) state.start = performance.now();
        },
        { capture: true, once: true },
      );
    });

    await page.mouse.move(box.x + box.width * 0.62, y - box.height * 0.08);
    await page.waitForFunction(
      () => window.__ARQ_PERF_WALL_PREVIEW__?.settled !== null,
      undefined,
      {
        timeout: 10_000,
      },
    );

    const measured = await page.evaluate(() => {
      const state = window.__ARQ_PERF_WALL_PREVIEW__;
      const longTasks = state.longTasks.filter(
        (entry) => entry.startTime >= state.start && entry.startTime <= state.settled,
      );
      return {
        interactionLatencyMs: state.firstVisible - state.start,
        settledMs: state.settled - state.start,
        mainThreadLongTaskCount: longTasks.length,
        mainThreadLongTaskTotalMs: longTasks.reduce((sum, entry) => sum + entry.duration, 0),
      };
    });
    if (!Number.isFinite(measured.interactionLatencyMs) || measured.interactionLatencyMs < 0) {
      throw new Error(
        `Wall preview interaction latency is invalid: ${measured.interactionLatencyMs}.`,
      );
    }
    if (
      !Number.isFinite(measured.settledMs) ||
      measured.settledMs < measured.interactionLatencyMs
    ) {
      throw new Error(`Wall preview settled timing is invalid: ${measured.settledMs}.`);
    }

    const placeholderAfter = await input.getAttribute('placeholder');
    const canvasAfterHash = sha256(await planCanvas.screenshot());
    if (placeholderAfter === null || placeholderAfter === placeholderBefore) {
      throw new Error('Wall preview timing completed without a changed live candidate length.');
    }
    if (canvasAfterHash === canvasBeforeHash) {
      throw new Error('Wall preview timing completed without a visible Plan-canvas change.');
    }
    if (browserErrors.length > 0) {
      throw new Error(`Wall preview sample emitted browser errors (${browserErrors.length}).`);
    }

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="arq-wall-hud"]') === null,
      undefined,
      { timeout: 5_000 },
    );

    return {
      interactionLatencyMs: measured.interactionLatencyMs,
      settledMs: measured.settledMs,
      mainThreadLongTaskCount: measured.mainThreadLongTaskCount,
      mainThreadLongTaskTotalMs: measured.mainThreadLongTaskTotalMs,
      previewValidated: true,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  ensureProductionWebBuild();
  const authority = readPerformanceAuthority();
  const workflow = getWorkflow(authority, 'wall.preview');
  const fixtureId = authority.fixtureContract?.id;
  if (authority.fixtureContract?.productExecutable !== true || !fixtureId) {
    throw new Error('Core wall-preview evidence requires the product-executable Core fixture.');
  }

  const fixture = createCoreWorkflowFixture('wall-preview');
  const server = await startProductionWebServer();
  const origin = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });

  try {
    const sampleCount = Math.max(authority.regressionPolicy.minimumSamplesForAcceptedTiming, 7);
    const samples = [];
    for (let index = 0; index < sampleCount; index += 1) {
      samples.push(await measureWallPreview(browser, origin, fixture.fixturePath));
    }
    const numeric = (key) =>
      samples.flatMap((sample) => (typeof sample[key] === 'number' ? [sample[key]] : []));
    const environment = browserEnvironment(browser);
    const report = buildDiagnosticRecord({
      workflowId: workflow.id,
      subsystem: workflow.owner,
      fixtureId,
      repositorySha: repositorySha(),
      coldOrWarm: 'warm-plan-core-project-draft-preview-per-sample',
      environment,
      samples,
      aggregates: {
        interactionLatencyMs: aggregateSamples(numeric('interactionLatencyMs')),
        settledMs: aggregateSamples(numeric('settledMs')),
        mainThreadLongTaskTotalMs: aggregateSamples(numeric('mainThreadLongTaskTotalMs')),
      },
      counters: {
        sampleCount: samples.length,
        previewValidatedSamples: samples.filter((sample) => sample.previewValidated).length,
        totalLongTasks: samples.reduce((sum, sample) => sum + sample.mainThreadLongTaskCount, 0),
      },
      bottleneckClasses: ['main-thread', 'rendering'],
    });

    mkdirSync(outDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(outDir, `core-workflow-wall-preview-${timestamp}.json`);
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
