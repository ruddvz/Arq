#!/usr/bin/env node
/**
 * #402 scheduled/reference measurement for `3d.orbit-selection` on the real
 * product-executable Core fixture.
 *
 * Setup opens the Core project and 3D surface through real product controls.
 * The measured work then covers both halves of the workflow: a primary-button
 * orbit drag and a known-good 3D wall-selection transition. Selection discovery
 * happens before timing: the probe finds two visually distinct selectable wall
 * states and deliberately leaves state B active, then times the real click that
 * changes selection to state A. Validation after the timed window proves the
 * green shared-selection treatment changed, so screenshot/decode work cannot
 * inflate product latency.
 */
import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  aggregateSamples,
  buildDiagnosticRecord,
  getWorkflow,
  percentile,
  readPerformanceAuthority,
  repoRoot,
} from './lib/performance-authority.mjs';
import {
  analyzeCanvasPixels,
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

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function twoFrames(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
}

async function findDistinctSelectableWallStates(page, modelCanvas) {
  const box = await modelCanvas.boundingBox();
  if (box === null || box.width <= 0 || box.height <= 0) {
    throw new Error('3D canvas has no measurable bounds.');
  }

  const xFractions = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75];
  const yFractions = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75];
  const states = [];
  const seenHashes = new Set();
  for (const yFraction of yFractions) {
    for (const xFraction of xFractions) {
      const position = { x: box.width * xFraction, y: box.height * yFraction };
      await modelCanvas.click({ position });
      await twoFrames(page);
      const screenshot = await modelCanvas.screenshot();
      const pixels = await analyzeCanvasPixels(page, screenshot);
      if (pixels.greenDominantPixels <= 20) continue;
      const visualHash = sha256(screenshot);
      if (seenHashes.has(visualHash)) continue;
      seenHashes.add(visualHash);
      states.push({ position, visualHash, greenDominantPixels: pixels.greenDominantPixels });
      if (states.length === 2) return states;
    }
  }
  throw new Error('Could not discover two visually distinct selectable wall states on Core 3D.');
}

async function measureOrbit(page, modelCanvas) {
  const beforeHash = sha256(await modelCanvas.screenshot());
  await modelCanvas.evaluate((canvas) => {
    const state = {
      start: null,
      firstFrame: null,
      settled: null,
      lastFrame: null,
      frameIntervals: [],
      longTasks: [],
    };
    window.__ARQ_PERF_3D_ORBIT__ = state;
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            state.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch {
        // Optional evidence only.
      }
    }
    canvas.addEventListener(
      'pointermove',
      () => {
        if (state.start !== null) return;
        state.start = performance.now();
        requestAnimationFrame(function observeFrame(timestamp) {
          if (state.firstFrame === null) state.firstFrame = performance.now();
          if (state.lastFrame !== null) state.frameIntervals.push(timestamp - state.lastFrame);
          state.lastFrame = timestamp;
          if (state.settled === null) requestAnimationFrame(observeFrame);
        });
      },
      { capture: true, once: true },
    );
    canvas.addEventListener(
      'pointerup',
      () => {
        if (state.start === null) return;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            state.settled = performance.now();
          });
        });
      },
      { capture: true, once: true },
    );
  });

  const box = await modelCanvas.boundingBox();
  if (box === null) throw new Error('3D canvas bounds disappeared before orbit measurement.');
  const startX = box.x + box.width * 0.48;
  const startY = box.y + box.height * 0.52;
  await page.mouse.move(startX, startY);
  await page.mouse.down({ button: 'left' });
  for (let index = 1; index <= 24; index += 1) {
    await page.mouse.move(startX + index * 6, startY + Math.sin(index / 4) * 42);
    await page.waitForTimeout(8);
  }
  await page.mouse.up({ button: 'left' });
  await page.waitForFunction(() => window.__ARQ_PERF_3D_ORBIT__?.settled !== null, undefined, {
    timeout: 10_000,
  });

  const measured = await page.evaluate(() => {
    const state = window.__ARQ_PERF_3D_ORBIT__;
    const longTasks = state.longTasks.filter(
      (entry) => entry.startTime >= state.start && entry.startTime <= state.settled,
    );
    return {
      interactionLatencyMs: state.firstFrame - state.start,
      settledMs: state.settled - state.start,
      frameIntervals: state.frameIntervals,
      mainThreadLongTaskCount: longTasks.length,
      mainThreadLongTaskTotalMs: longTasks.reduce((sum, entry) => sum + entry.duration, 0),
    };
  });
  if (!Number.isFinite(measured.interactionLatencyMs) || measured.interactionLatencyMs < 0) {
    throw new Error(`Orbit interaction latency is invalid: ${measured.interactionLatencyMs}.`);
  }
  const afterHash = sha256(await modelCanvas.screenshot());
  if (beforeHash === afterHash) {
    throw new Error('Orbit gesture completed without a visible 3D frame change.');
  }
  await validateRenderedWebglCanvas(page, modelCanvas, '3D orbit sample');
  return {
    orbitInteractionLatencyMs: measured.interactionLatencyMs,
    orbitSettledMs: measured.settledMs,
    p95FrameMs: percentile(measured.frameIntervals, 0.95),
    orbitFrameCount: measured.frameIntervals.length,
    mainThreadLongTaskCount: measured.mainThreadLongTaskCount,
    mainThreadLongTaskTotalMs: measured.mainThreadLongTaskTotalMs,
    orbitChanged: true,
  };
}

async function measureSelection(page, modelCanvas, targetState, preparedState) {
  await modelCanvas.evaluate((canvas) => {
    const state = { start: null, firstFrame: null, settled: null, longTasks: [] };
    window.__ARQ_PERF_3D_SELECTION__ = state;
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            state.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch {
        // Optional evidence only.
      }
    }
    canvas.addEventListener(
      'pointerup',
      () => {
        state.start = performance.now();
        requestAnimationFrame(() => {
          state.firstFrame = performance.now();
          requestAnimationFrame(() => {
            state.settled = performance.now();
          });
        });
      },
      { capture: true, once: true },
    );
  });

  await modelCanvas.click({ position: targetState.position });
  await page.waitForFunction(() => window.__ARQ_PERF_3D_SELECTION__?.settled !== null, undefined, {
    timeout: 10_000,
  });
  const measured = await page.evaluate(() => {
    const state = window.__ARQ_PERF_3D_SELECTION__;
    const longTasks = state.longTasks.filter(
      (entry) => entry.startTime >= state.start && entry.startTime <= state.settled,
    );
    return {
      interactionLatencyMs: state.firstFrame - state.start,
      settledMs: state.settled - state.start,
      mainThreadLongTaskCount: longTasks.length,
      mainThreadLongTaskTotalMs: longTasks.reduce((sum, entry) => sum + entry.duration, 0),
    };
  });
  if (!Number.isFinite(measured.interactionLatencyMs) || measured.interactionLatencyMs < 0) {
    throw new Error(`Selection interaction latency is invalid: ${measured.interactionLatencyMs}.`);
  }
  const screenshot = await modelCanvas.screenshot();
  const visualHash = sha256(screenshot);
  const pixels = await analyzeCanvasPixels(page, screenshot);
  if (pixels.greenDominantPixels <= 20) {
    throw new Error('Timed 3D selection did not produce the shared green selection treatment.');
  }
  if (visualHash === preparedState.visualHash) {
    throw new Error('Timed 3D selection did not visibly change the prepared selection state.');
  }
  return {
    selectionInteractionLatencyMs: measured.interactionLatencyMs,
    selectionSettledMs: measured.settledMs,
    mainThreadLongTaskCount: measured.mainThreadLongTaskCount,
    mainThreadLongTaskTotalMs: measured.mainThreadLongTaskTotalMs,
    selectionValidated: true,
  };
}

async function measureOrbitSelection(browser, origin, fixturePath) {
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
    await tab3d.click();
    const modelCanvas = page.locator('canvas[aria-label="3D model view"]');
    await modelCanvas.waitFor({ state: 'visible', timeout: 10_000 });
    await twoFrames(page);
    await validateRenderedWebglCanvas(page, modelCanvas, '3D orbit-selection setup');

    const orbit = await measureOrbit(page, modelCanvas);
    const [targetState, preparedState] = await findDistinctSelectableWallStates(page, modelCanvas);
    const preparedScreenshot = await modelCanvas.screenshot();
    const preparedPixels = await analyzeCanvasPixels(page, preparedScreenshot);
    if (preparedPixels.greenDominantPixels <= 20) {
      throw new Error('Discovered prepared 3D selection state was not active before timing.');
    }
    preparedState.visualHash = sha256(preparedScreenshot);
    const selection = await measureSelection(page, modelCanvas, targetState, preparedState);
    if (browserErrors.length > 0) {
      throw new Error(
        `3D orbit-selection sample emitted browser errors (${browserErrors.length}).`,
      );
    }

    return {
      interactionLatencyMs: Math.max(
        orbit.orbitInteractionLatencyMs,
        selection.selectionInteractionLatencyMs,
      ),
      p95FrameMs: orbit.p95FrameMs,
      settledMs: Math.max(orbit.orbitSettledMs, selection.selectionSettledMs),
      orbitInteractionLatencyMs: orbit.orbitInteractionLatencyMs,
      orbitSettledMs: orbit.orbitSettledMs,
      selectionInteractionLatencyMs: selection.selectionInteractionLatencyMs,
      selectionSettledMs: selection.selectionSettledMs,
      orbitFrameCount: orbit.orbitFrameCount,
      mainThreadLongTaskCount: orbit.mainThreadLongTaskCount + selection.mainThreadLongTaskCount,
      mainThreadLongTaskTotalMs:
        orbit.mainThreadLongTaskTotalMs + selection.mainThreadLongTaskTotalMs,
      orbitChanged: orbit.orbitChanged,
      selectionValidated: selection.selectionValidated,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  ensureProductionWebBuild();
  const authority = readPerformanceAuthority();
  const workflow = getWorkflow(authority, '3d.orbit-selection');
  const fixtureId = authority.fixtureContract?.id;
  if (authority.fixtureContract?.productExecutable !== true || !fixtureId) {
    throw new Error('3D orbit-selection evidence requires the product-executable Core fixture.');
  }

  const fixture = createCoreWorkflowFixture('3d-orbit-selection');
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
      samples.push(await measureOrbitSelection(browser, origin, fixture.fixturePath));
    }
    const numeric = (key) =>
      samples.flatMap((sample) => (typeof sample[key] === 'number' ? [sample[key]] : []));
    const environment = browserEnvironment(browser);
    const report = buildDiagnosticRecord({
      workflowId: workflow.id,
      subsystem: workflow.owner,
      fixtureId,
      repositorySha: repositorySha(),
      coldOrWarm: 'warm-3d-view-core-project-per-sample',
      environment,
      samples,
      aggregates: {
        interactionLatencyMs: aggregateSamples(numeric('interactionLatencyMs')),
        p95FrameMs: aggregateSamples(numeric('p95FrameMs')),
        settledMs: aggregateSamples(numeric('settledMs')),
        orbitInteractionLatencyMs: aggregateSamples(numeric('orbitInteractionLatencyMs')),
        orbitSettledMs: aggregateSamples(numeric('orbitSettledMs')),
        selectionInteractionLatencyMs: aggregateSamples(numeric('selectionInteractionLatencyMs')),
        selectionSettledMs: aggregateSamples(numeric('selectionSettledMs')),
        mainThreadLongTaskTotalMs: aggregateSamples(numeric('mainThreadLongTaskTotalMs')),
      },
      counters: {
        sampleCount: samples.length,
        orbitValidatedSamples: samples.filter((sample) => sample.orbitChanged).length,
        selectionValidatedSamples: samples.filter((sample) => sample.selectionValidated).length,
        totalLongTasks: samples.reduce((sum, sample) => sum + sample.mainThreadLongTaskCount, 0),
      },
      bottleneckClasses: ['main-thread', 'rendering', 'frame-time'],
    });

    mkdirSync(outDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(outDir, `core-workflow-3d-orbit-selection-${timestamp}.json`);
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
