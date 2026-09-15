#!/usr/bin/env node
/**
 * Reference-only compositing probe for #403 inputs consumed by #402.
 * It uses the production material CSS inside the built product and animates a
 * synthetic non-project backdrop beneath bounded regular, strong and optical
 * surfaces. No project names, geometry, document text or user content is read.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { cpus, platform, arch } from 'node:os';
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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.woff2': 'font/woff2' };

function sha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
}

function startServer() {
  const server = createServer((request, response) => {
    const requested = (request.url ?? '/').split('?')[0];
    let file = path.join(distDir, decodeURIComponent(requested));
    if (!file.startsWith(distDir)) return response.writeHead(403).end();
    if (!existsSync(file) || !path.extname(file)) file = path.join(distDir, 'index.html');
    response.setHeader('Content-Type', MIME[path.extname(file)] ?? 'application/octet-stream');
    response.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function runProbe(browser, origin, forcedColors) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    ...(forcedColors ? { forcedColors: 'active' } : {}),
  });
  const page = await context.newPage();
  await page.goto(origin);
  await page.waitForSelector('.arq-view-kinds', { timeout: 30_000 });
  const result = await page.evaluate(async () => {
    const host = document.createElement('div');
    host.setAttribute('data-arq-perf-probe', 'material-compositing');
    host.style.cssText = 'position:fixed;inset:120px 120px 120px 120px;z-index:999998;pointer-events:none;overflow:hidden;background:repeating-linear-gradient(45deg,#183a32 0 18px,#d9e8e2 18px 36px)';
    const moving = document.createElement('div');
    moving.style.cssText = 'position:absolute;inset:-30%;background:repeating-radial-gradient(circle,#0b6b50 0 8px,#f6efe4 8px 20px);will-change:transform';
    host.appendChild(moving);
    const definitions = [
      ['regular', 'arq-material'],
      ['strong', 'arq-material arq-material--strong'],
      ['optical', 'arq-material arq-material--optical'],
    ];
    const surfaces = [];
    definitions.forEach(([name, className], index) => {
      const surface = document.createElement('div');
      surface.className = className;
      surface.dataset.name = name;
      surface.style.cssText = `position:absolute;left:${80 + index * 210}px;top:${90 + index * 100}px;width:430px;height:300px;border-radius:24px`;
      host.appendChild(surface);
      surfaces.push(surface);
    });
    document.body.appendChild(host);
    const styles = Object.fromEntries(surfaces.map((surface) => [surface.dataset.name, {
      backdropFilter: getComputedStyle(surface).backdropFilter,
      boxShadow: getComputedStyle(surface).boxShadow,
      backgroundColor: getComputedStyle(surface).backgroundColor,
    }]));
    const frameTimes = [];
    const longTasks = [];
    let observer = null;
    if ('PerformanceObserver' in window) {
      try {
        observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => longTasks.push(entry.duration)));
        observer.observe({ type: 'longtask', buffered: true });
      } catch {}
    }
    await new Promise((resolve) => {
      let previous = null;
      let frame = 0;
      const tick = (now) => {
        moving.style.transform = `translate3d(${(frame % 80) - 40}px,${((frame * 2) % 80) - 40}px,0)`;
        if (previous !== null && frame > 20) frameTimes.push(now - previous);
        previous = now;
        frame += 1;
        if (frame < 201) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    observer?.disconnect();
    host.remove();
    return { frameTimes, longTasks, styles };
  });
  await context.close();
  return result;
}

async function main() {
  if (!existsSync(path.join(distDir, 'index.html'))) throw new Error('apps/web/dist is absent. Build the production web app first.');
  const authority = readPerformanceAuthority();
  const workflow = getWorkflow(authority, 'material.compositing');
  const server = await startServer();
  const origin = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ headless: true, ...(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}) });
  try {
    const states = {};
    for (const [name, forcedColors] of [['default', false], ['forced-colors', true]]) {
      const runs = [];
      for (let i = 0; i < 3; i += 1) runs.push(await runProbe(browser, origin, forcedColors));
      const frames = runs.flatMap((run) => run.frameTimes);
      const longTasks = runs.flatMap((run) => run.longTasks);
      states[name] = {
        frameMs: aggregateSamples(frames),
        longTaskMs: aggregateSamples(longTasks),
        styles: runs[0].styles,
        runCount: runs.length,
      };
    }
    const report = buildDiagnosticRecord({
      workflowId: workflow.id,
      subsystem: workflow.owner,
      fixtureId: 'shell-material-probe-v1',
      repositorySha: sha(),
      coldOrWarm: 'warm-compositing-after-product-load',
      environment: {
        browser: `Chromium ${browser.version()}`,
        os: `${platform()} ${arch()}`,
        cpuModel: cpus()[0]?.model ?? 'unknown',
        logicalCpuCount: cpus().length,
        runner: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
      },
      samples: [],
      aggregates: states,
      counters: { productionMaterialVariants: 3, overlappingSurfaces: 3 },
      bottleneckClasses: ['compositing', 'backdrop-filter', 'frame-time'],
    });
    mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `material-compositing-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    writeFileSync(file, `${JSON.stringify({ ...report, budget: null, enforcement: workflow.enforcement }, null, 2)}\n`);
    console.log(JSON.stringify({ file: path.relative(repoRoot, file), states }, null, 2));
  } finally {
    await browser.close();
    server.close();
  }
}

await main();
