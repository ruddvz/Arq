#!/usr/bin/env node
/**
 * Scheduled/reference workflow measurement for #402.
 *
 * This intentionally measures only product states that have stable observable
 * completion markers at current head. It does not reach into App.tsx or invent
 * alternate state/command authority while #361/#420 own those paths.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { cpus, platform, arch, release } from 'node:os';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    if (!existsSync(filePath) || !path.extname(filePath)) filePath = path.join(distDir, 'index.html');
    response.setHeader('Content-Type', MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream');
    response.end(readFileSync(filePath));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function measureBoot(browser, origin) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__ARQ_PERF_LONG_TASKS__ = [];
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__ARQ_PERF_LONG_TASKS__.push({ startTime: entry.startTime, duration: entry.duration });
          }
        });
        observer.observe({ type: 'longtask', buffered: true });
      } catch {
        // Browser does not expose Long Tasks. The report records an empty list rather than fabricating it.
      }
    }
  });
  await page.goto(origin, { waitUntil: 'load' });
  await page.waitForSelector('.arq-shell-button', { state: 'visible', timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelector('.arq-status-bar')?.textContent?.includes('Journal current'),
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas');
    return canvas !== null && canvas.clientWidth > 0 && canvas.clientHeight > 0;
  }, undefined, { timeout: 30_000 });
  const sample = await page.evaluate(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const navigation = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByName('first-contentful-paint')[0];
    const longTasks = window.__ARQ_PERF_LONG_TASKS__ ?? [];
    return {
      firstVisibleMs: paint?.startTime ?? null,
      settledMs: performance.now(),
      domContentLoadedMs: navigation?.domContentLoadedEventEnd ?? null,
      loadEventMs: navigation?.loadEventEnd ?? null,
      mainThreadLongTaskCount: longTasks.length,
      mainThreadLongTaskTotalMs: longTasks.reduce((sum, task) => sum + task.duration, 0),
    };
  });
  await context.close();
  return sample;
}

async function main() {
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('apps/web/dist is absent. Run the production web build before this benchmark.');
  }
  const authority = readPerformanceAuthority();
  const workflow = getWorkflow(authority, 'app.boot.usable-workspace');
  const server = await startServer();
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}/`;
  const browser = await chromium.launch({ executablePath: resolveChromiumExecutablePath(), headless: true });
  try {
    const sampleCount = Math.max(authority.regressionPolicy.minimumSamplesForAcceptedTiming, 7);
    const samples = [];
    for (let index = 0; index < sampleCount; index += 1) samples.push(await measureBoot(browser, origin));
    const settled = samples.map((sample) => sample.settledMs);
    const firstVisible = samples.flatMap((sample) => sample.firstVisibleMs === null ? [] : [sample.firstVisibleMs]);
    const longTaskTotals = samples.map((sample) => sample.mainThreadLongTaskTotalMs);
    const environment = {
      browser: `Chromium ${browser.version()}`,
      engine: 'Chromium',
      os: `${platform()} ${release()} ${arch()}`,
      cpuModel: cpus()[0]?.model ?? 'unknown',
      logicalCpuCount: cpus().length,
      runner: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
    };
    const report = buildDiagnosticRecord({
      workflowId: workflow.id,
      subsystem: workflow.owner,
      fixtureId: null,
      repositorySha: repositorySha(),
      coldOrWarm: 'cold-new-browser-context-per-sample',
      environment,
      samples,
      aggregates: {
        firstVisibleMs: aggregateSamples(firstVisible),
        settledMs: aggregateSamples(settled),
        mainThreadLongTaskTotalMs: aggregateSamples(longTaskTotals),
      },
      counters: {
        sampleCount: samples.length,
        totalLongTasks: samples.reduce((sum, sample) => sum + sample.mainThreadLongTaskCount, 0),
      },
      bottleneckClasses: ['startup-main-thread', 'startup-rendering'],
    });
    mkdirSync(outDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(outDir, `core-workflow-boot-${timestamp}.json`);
    writeFileSync(file, `${JSON.stringify({ ...report, budget: workflow.budget, enforcement: workflow.enforcement }, null, 2)}\n`);
    console.log(JSON.stringify({ file: path.relative(repoRoot, file), aggregates: report.aggregates, environment }, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
}

await main();
