#!/usr/bin/env node
/**
 * #402 scheduled/reference measurement for `pdf.vector-generation` on the
 * product-executable Core fixture.
 *
 * Opening the Core project is setup only. The timed window starts when the real
 * command-palette export option is activated and ends when the product has
 * produced the PDF Blob passed to URL.createObjectURL. Download I/O and PDF
 * inspection happen after that window, but invalidate the sample if the bytes
 * are not a complete PDF with painted vector paths.
 */
import { chromium } from 'playwright';
import { inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

function inflateStreams(bytes) {
  const latin1 = bytes.toString('latin1');
  const parts = [];
  const pattern = /stream\r?\n?/g;
  let match;
  while ((match = pattern.exec(latin1)) !== null) {
    const start = match.index + match[0].length;
    const end = latin1.indexOf('endstream', start);
    if (end === -1) continue;
    try {
      parts.push(inflateSync(bytes.subarray(start, end)).toString('latin1'));
    } catch {
      // PDFs may contain non-Flate streams; they are irrelevant to this proof.
    }
  }
  return parts.join('\n');
}

function validateVectorPdf(bytes) {
  const signature = bytes.subarray(0, 5).toString('latin1');
  const trailer = bytes.subarray(-2048).toString('latin1').includes('%%EOF');
  const content = inflateStreams(bytes);
  const hasPath = /(?:^|\s)(?:re|[ml])(?:\s|$)/m.test(content) && /\s[SsfFB]\s/.test(content);
  if (signature !== '%PDF-')
    throw new Error(`vector PDF signature is ${signature}, expected %PDF-.`);
  if (!trailer) throw new Error('vector PDF is missing its %%EOF trailer.');
  if (!hasPath) throw new Error('vector PDF contains no painted path operators.');
}

async function measurePdfGeneration(browser, origin, fixturePath) {
  const context = await browser.newContext({
    viewport: { width: 1536, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', (error) => browserErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });

  try {
    await openCoreWorkflowProject(page, origin, fixturePath);
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    const search = palette.getByRole('combobox', { name: 'Search commands' });
    await search.fill('Export sheet');
    const option = palette.getByRole('option', { name: /Export sheet as PDF/ }).first();
    await option.waitFor({ state: 'visible', timeout: 10_000 });

    await option.evaluate((element) => {
      performance.clearResourceTimings();
      const state = {
        start: null,
        blobReady: null,
        blobBytes: null,
        longTasks: [],
      };
      window.__ARQ_PERF_PDF_VECTOR__ = state;
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
      const originalCreateObjectURL = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (blob) => {
        if (state.start !== null && state.blobReady === null) {
          state.blobReady = performance.now();
          state.blobBytes = blob.size;
        }
        return originalCreateObjectURL(blob);
      };
      element.addEventListener(
        'click',
        () => {
          state.start = performance.now();
        },
        { capture: true, once: true },
      );
    });

    const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
    await option.click();
    const download = await downloadPromise;
    await page.waitForFunction(
      () => window.__ARQ_PERF_PDF_VECTOR__?.blobReady !== null,
      undefined,
      {
        timeout: 30_000,
      },
    );

    const measured = await page.evaluate(() => {
      const state = window.__ARQ_PERF_PDF_VECTOR__;
      const longTasks = state.longTasks.filter(
        (entry) => entry.startTime >= state.start && entry.startTime <= state.blobReady,
      );
      const chunk = performance
        .getEntriesByType('resource')
        .find((entry) => /\/sheet-export-[^/]+\.js(?:$|\?)/.test(entry.name));
      return {
        generationMs: state.blobReady - state.start,
        chunkLoadMs: chunk?.duration ?? null,
        blobBytes: state.blobBytes,
        mainThreadLongTaskCount: longTasks.length,
        mainThreadLongTaskTotalMs: longTasks.reduce((sum, entry) => sum + entry.duration, 0),
      };
    });

    const streamPath = await download.path();
    if (!streamPath) throw new Error('vector PDF download has no readable path.');
    const bytes = readFileSync(streamPath);
    validateVectorPdf(bytes);
    if (bytes.length !== measured.blobBytes) {
      throw new Error(
        `vector PDF blob/download byte mismatch: ${measured.blobBytes} vs ${bytes.length}.`,
      );
    }
    if (browserErrors.length > 0) {
      throw new Error(`vector PDF sample emitted browser errors (${browserErrors.length}).`);
    }

    return {
      generationMs: measured.generationMs,
      settledMs: measured.generationMs,
      chunkLoadMs: measured.chunkLoadMs,
      pdfBytes: bytes.length,
      mainThreadLongTaskCount: measured.mainThreadLongTaskCount,
      mainThreadLongTaskTotalMs: measured.mainThreadLongTaskTotalMs,
      vectorValidated: true,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  ensureProductionWebBuild();
  const authority = readPerformanceAuthority();
  const workflow = getWorkflow(authority, 'pdf.vector-generation');
  const fixtureId = authority.fixtureContract?.id;
  if (authority.fixtureContract?.productExecutable !== true || !fixtureId) {
    throw new Error('Core vector PDF evidence requires the product-executable Core fixture.');
  }

  const fixture = createCoreWorkflowFixture('pdf-vector-generation');
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
      samples.push(await measurePdfGeneration(browser, origin, fixture.fixturePath));
    }
    const numeric = (key) =>
      samples.flatMap((sample) => (typeof sample[key] === 'number' ? [sample[key]] : []));
    const environment = browserEnvironment(browser);
    const report = buildDiagnosticRecord({
      workflowId: workflow.id,
      subsystem: workflow.owner,
      fixtureId,
      repositorySha: repositorySha(),
      coldOrWarm: 'cold-export-chunk-core-project-per-sample',
      environment,
      samples,
      aggregates: {
        generationMs: aggregateSamples(numeric('generationMs')),
        settledMs: aggregateSamples(numeric('settledMs')),
        chunkLoadMs: aggregateSamples(numeric('chunkLoadMs')),
        pdfBytes: aggregateSamples(numeric('pdfBytes')),
        mainThreadLongTaskTotalMs: aggregateSamples(numeric('mainThreadLongTaskTotalMs')),
      },
      counters: {
        sampleCount: samples.length,
        vectorValidatedSamples: samples.filter((sample) => sample.vectorValidated).length,
        totalLongTasks: samples.reduce((sum, sample) => sum + sample.mainThreadLongTaskCount, 0),
      },
      bottleneckClasses: ['deferred-chunk', 'main-thread', 'rendering'],
    });

    mkdirSync(outDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(outDir, `core-workflow-pdf-vector-generation-${timestamp}.json`);
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
