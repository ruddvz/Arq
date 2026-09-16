#!/usr/bin/env node
/**
 * #402 scheduled/reference measurement for `plan.snap-resolution` on the
 * product-executable Core fixture.
 *
 * Opening the Core project, arming Wall and placing the first draft anchor are
 * setup. The benchmark discovers a stable real snap transition outside the
 * timed window, then measures the actual pointer move until the product StatusBar
 * publishes the new snap label and two animation frames settle. Post-timing
 * validation requires the Plan canvas and Wall HUD candidate to reflect the same
 * interaction. The draft is cancelled; no semantic operation is committed.
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
const STATUS_BAR = '.arq-status-bar';
const HUD = '[data-testid="arq-wall-hud"]';
const HUD_INPUT = '#arq-wall-length-input';
const SNAP_LABELS = [
  'Endpoint',
  'Intersection',
  'Midpoint',
  'Perpendicular',
  'Centre',
  'Grid',
  'Extension',
  'Nearest',
];
const PREFERRED_TARGETS = ['Endpoint', 'Midpoint', 'Intersection'];

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function snapLabelFromStatus(text) {
  return SNAP_LABELS.find((label) => text.includes(label)) ?? null;
}

async function statusSnapLabel(page) {
  return snapLabelFromStatus((await page.locator(STATUS_BAR).textContent()) ?? '');
}

async function prepareWallDraft(page, origin, fixturePath) {
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

  const anchor = {
    x: box.x + box.width * 0.31,
    y: box.y + box.height * 0.47,
  };
  await page.mouse.move(anchor.x, anchor.y);
  await page.mouse.click(anchor.x, anchor.y);
  await page.mouse.move(box.x + box.width * 0.42, anchor.y);
  await page.locator(HUD).waitFor({ state: 'visible', timeout: 5_000 });
  return { planCanvas, box };
}

async function discoverSnapTransition(page, box) {
  let fallback = null;
  let target = null;
  const xSteps = 36;
  const ySteps = 20;

  for (let yi = 2; yi < ySteps - 2 && target === null; yi += 1) {
    for (let xi = 2; xi < xSteps - 2; xi += 1) {
      const point = {
        x: box.x + (box.width * xi) / xSteps,
        y: box.y + (box.height * yi) / ySteps,
      };
      await page.mouse.move(point.x, point.y);
      await page.waitForTimeout(8);
      const label = await statusSnapLabel(page);
      if (label === null) continue;
      if (fallback === null || label === 'Grid') fallback = { ...point, label };
      if (PREFERRED_TARGETS.includes(label)) {
        target = { ...point, label };
        break;
      }
    }
  }

  if (target === null) {
    throw new Error('Could not discover an endpoint/midpoint/intersection snap on the Core Plan.');
  }

  if (fallback === null || fallback.label === target.label) {
    for (let yi = ySteps - 3; yi >= 2; yi -= 1) {
      for (let xi = xSteps - 3; xi >= 2; xi -= 1) {
        const point = {
          x: box.x + (box.width * xi) / xSteps,
          y: box.y + (box.height * yi) / ySteps,
        };
        await page.mouse.move(point.x, point.y);
        await page.waitForTimeout(8);
        const label = await statusSnapLabel(page);
        if (label !== null && label !== target.label) {
          fallback = { ...point, label };
          break;
        }
      }
      if (fallback !== null && fallback.label !== target.label) break;
    }
  }

  if (fallback === null || fallback.label === target.label) {
    throw new Error(`Could not discover a baseline snap distinct from ${target.label}.`);
  }
  return { baseline: fallback, target };
}

async function measureSnapResolution(browser, origin, fixturePath, transitionHint) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 900 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  try {
    const { planCanvas, box } = await prepareWallDraft(page, origin, fixturePath);
    const transition = transitionHint ?? (await discoverSnapTransition(page, box));
    const baseline = {
      x: box.x + transition.baseline.xFraction * box.width,
      y: box.y + transition.baseline.yFraction * box.height,
      label: transition.baseline.label,
    };
    const target = {
      x: box.x + transition.target.xFraction * box.width,
      y: box.y + transition.target.yFraction * box.height,
      label: transition.target.label,
    };

    await page.mouse.move(baseline.x, baseline.y);
    await page.waitForFunction(
      ({ selector, label }) => document.querySelector(selector)?.textContent?.includes(label) === true,
      { selector: STATUS_BAR, label: baseline.label },
      { timeout: 5_000 },
    );
    const input = page.locator(HUD_INPUT);
    const placeholderBefore = await input.getAttribute('placeholder');
    if (placeholderBefore === null) throw new Error('Wall HUD candidate is unavailable before snap.');
    const canvasBeforeHash = sha256(await planCanvas.screenshot());

    await planCanvas.evaluate(
      (canvas, args) => {
        const status = document.querySelector(args.statusSelector);
        if (status === null) throw new Error('StatusBar is unavailable for snap timing.');
        const state = {
          start: null,
          firstVisible: null,
          settled: null,
          targetLabel: args.targetLabel,
          longTasks: [],
        };
        window.__ARQ_PERF_PLAN_SNAP__ = state;
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
          if ((status.textContent ?? '').includes(state.targetLabel)) {
            state.firstVisible = performance.now();
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                state.settled = performance.now();
                mutation.disconnect();
              });
            });
          }
        });
        mutation.observe(status, { subtree: true, childList: true, characterData: true });
        canvas.addEventListener(
          'pointermove',
          () => {
            if (state.start === null) state.start = performance.now();
          },
          { capture: true, once: true },
        );
      },
      { statusSelector: STATUS_BAR, targetLabel: target.label },
    );

    await page.mouse.move(target.x, target.y);
    await page.waitForFunction(() => window.__ARQ_PERF_PLAN_SNAP__?.settled !== null, undefined, {
      timeout: 10_000,
    });

    const measured = await page.evaluate(() => {
      const state = window.__ARQ_PERF_PLAN_SNAP__;
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
      throw new Error(`Snap interaction latency is invalid: ${measured.interactionLatencyMs}.`);
    }
    if (!Number.isFinite(measured.settledMs) || measured.settledMs < measured.interactionLatencyMs) {
      throw new Error(`Snap settled timing is invalid: ${measured.settledMs}.`);
    }

    const liveLabel = await statusSnapLabel(page);
    const placeholderAfter = await input.getAttribute('placeholder');
    const canvasAfterHash = sha256(await planCanvas.screenshot());
    if (liveLabel !== target.label) {
      throw new Error(`Expected snap ${target.label}, observed ${liveLabel ?? 'none'}.`);
    }
    if (placeholderAfter === null || placeholderAfter === placeholderBefore) {
      throw new Error('Snap timing completed without the Wall tool consuming a new candidate.');
    }
    if (canvasAfterHash === canvasBeforeHash) {
      throw new Error('Snap timing completed without a visible Plan-canvas change.');
    }
    if (browserErrors.length > 0) {
      throw new Error(`Snap sample emitted browser errors (${browserErrors.length}).`);
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
      targetSnap: target.label,
      snapValidated: true,
      transition: {
        baseline: {
          xFraction: (baseline.x - box.x) / box.width,
          yFraction: (baseline.y - box.y) / box.height,
          label: baseline.label,
        },
        target: {
          xFraction: (target.x - box.x) / box.width,
          yFraction: (target.y - box.y) / box.height,
          label: target.label,
        },
      },
    };
  } finally {
    await context.close();
  }
}

async function main() {
  ensureProductionWebBuild();
  const authority = readPerformanceAuthority();
  const workflow = getWorkflow(authority, 'plan.snap-resolution');
  const fixtureId = authority.fixtureContract?.id;
  if (authority.fixtureContract?.productExecutable !== true || !fixtureId) {
    throw new Error('Core snap evidence requires the product-executable Core fixture.');
  }

  const fixture = createCoreWorkflowFixture('plan-snap-resolution');
  const server = await startProductionWebServer();
  const origin = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });

  try {
    const sampleCount = Math.max(authority.regressionPolicy.minimumSamplesForAcceptedTiming, 7);
    const samples = [];
    let transitionHint = null;
    for (let index = 0; index < sampleCount; index += 1) {
      const sample = await measureSnapResolution(browser, origin, fixture.fixturePath, transitionHint);
      if (transitionHint === null) transitionHint = sample.transition;
      samples.push(sample);
    }
    const numeric = (key) =>
      samples.flatMap((sample) => (typeof sample[key] === 'number' ? [sample[key]] : []));
    const environment = browserEnvironment(browser);
    const report = buildDiagnosticRecord({
      workflowId: workflow.id,
      subsystem: workflow.owner,
      fixtureId,
      repositorySha: repositorySha(),
      coldOrWarm: 'warm-plan-core-project-wall-draft-per-sample',
      environment,
      samples: samples.map(({ transition: _transition, ...sample }) => sample),
      aggregates: {
        interactionLatencyMs: aggregateSamples(numeric('interactionLatencyMs')),
        settledMs: aggregateSamples(numeric('settledMs')),
        mainThreadLongTaskTotalMs: aggregateSamples(numeric('mainThreadLongTaskTotalMs')),
      },
      counters: {
        sampleCount: samples.length,
        snapValidatedSamples: samples.filter((sample) => sample.snapValidated).length,
        totalLongTasks: samples.reduce((sum, sample) => sum + sample.mainThreadLongTaskCount, 0),
      },
      bottleneckClasses: ['main-thread', 'rendering'],
    });

    mkdirSync(outDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(outDir, `core-workflow-plan-snap-resolution-${timestamp}.json`);
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
