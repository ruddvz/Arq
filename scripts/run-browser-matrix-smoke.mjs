#!/usr/bin/env node
/**
 * Cross-engine smoke evidence for issue #358.
 *
 * This deliberately reports engine capabilities instead of turning browser
 * version strings into product-support claims. Playwright WebKit is WebKit
 * engine evidence only. It is not certification of shipping Safari or any
 * physical Apple device.
 *
 * Usage:
 *   node scripts/run-browser-matrix-smoke.mjs
 *   node scripts/run-browser-matrix-smoke.mjs --browser chromium
 *   node scripts/run-browser-matrix-smoke.mjs --browser firefox
 *   node scripts/run-browser-matrix-smoke.mjs --browser webkit
 */

import { chromium, firefox, webkit } from 'playwright';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const webDir = path.join(repoRoot, 'apps/web');
const distDir = path.join(webDir, 'dist');
const resultsDir = path.join(repoRoot, 'benchmarks/results');

const engines = { chromium, firefox, webkit };
const requested = process.argv.includes('--browser')
  ? [process.argv[process.argv.indexOf('--browser') + 1]]
  : Object.keys(engines);

for (const name of requested) {
  if (!(name in engines)) {
    throw new Error(`Unsupported browser engine: ${name}. Expected chromium, firefox or webkit.`);
  }
}

function buildBundle() {
  execFileSync('pnpm', ['--filter', '@arq/web', 'build'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('web build did not produce apps/web/dist/index.html');
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
};

function startServer() {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const relative = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.resolve(distDir, `.${relative}`);
    if (
      !filePath.startsWith(`${distDir}${path.sep}`) &&
      filePath !== path.join(distDir, 'index.html')
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const contents = readFileSync(filePath);
      res.writeHead(200, {
        'content-type': MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      });
      res.end(contents);
    } catch {
      // Vite's production app is an SPA. Unknown route-like requests should
      // receive the application shell, while missing asset requests stay 404.
      if (!path.extname(relative)) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(readFileSync(path.join(distDir, 'index.html')));
        return;
      }
      res.writeHead(404);
      res.end();
    }
  });
}

async function probe(engineName, origin) {
  const browserType = engines[engineName];
  const browser = await browserType.launch({ headless: true });
  const browserVersion = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    const response = await page.goto(origin, { waitUntil: 'networkidle' });
    if (response === null || !response.ok()) {
      throw new Error(
        `application navigation failed with HTTP ${response?.status() ?? 'no-response'}`,
      );
    }

    await page.locator('.arq-workspace').waitFor({ state: 'visible', timeout: 15_000 });
    await page.locator('.arq-workspace__viewport').waitFor({ state: 'visible', timeout: 15_000 });

    const boot = await page.evaluate(() => {
      const root = document.querySelector('.arq-workspace');
      const viewport = document.querySelector('.arq-workspace__viewport');
      const rect = viewport?.getBoundingClientRect();
      return {
        title: document.title,
        workspacePresent: root !== null,
        viewportWidth: rect ? Math.round(rect.width) : 0,
        viewportHeight: rect ? Math.round(rect.height) : 0,
        horizontalOverflow:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
        userAgent: navigator.userAgent,
      };
    });

    // Keyboard smoke: a real Tab must move focus onto a rendered interactive
    // control. This catches a class of inert-shell regressions without tying
    // the matrix to one particular button label or visual composition.
    await page.keyboard.press('Tab');
    const keyboard = await page.evaluate(() => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return { passed: false, reason: 'no active element' };
      const tag = active.tagName.toLowerCase();
      const role = active.getAttribute('role');
      const rect = active.getBoundingClientRect();
      const interactive =
        ['a', 'button', 'input', 'select', 'textarea', 'summary'].includes(tag) ||
        role === 'button' ||
        role === 'tab' ||
        role === 'menuitem';
      return {
        passed: interactive && rect.width > 0 && rect.height > 0,
        tag,
        role,
        label: active.getAttribute('aria-label') ?? active.textContent?.trim().slice(0, 80) ?? '',
      };
    });

    const capability = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const webgpuAvailable =
        'gpu' in navigator && navigator.gpu !== undefined && navigator.gpu !== null;
      let webgl2Available = false;
      let webglAvailable = false;
      try {
        webgl2Available = canvas.getContext('webgl2') !== null;
      } catch {
        webgl2Available = false;
      }
      try {
        webglAvailable = canvas.getContext('webgl') !== null;
      } catch {
        webglAvailable = false;
      }
      const renderingCapability = webgpuAvailable
        ? 'webgpu-available'
        : webgl2Available
          ? 'webgl2-fallback-available'
          : webglAvailable
            ? 'webgl-fallback-available'
            : 'no-gpu-rendering-api';
      const capabilityStatus =
        renderingCapability === 'no-gpu-rendering-api' ? 'unavailable-in-runner' : 'available';
      return {
        webgpuAvailable,
        webgl2Available,
        webglAvailable,
        renderingCapability,
        capabilityStatus,
      };
    });

    const failures = [];
    if (!boot.workspacePresent) failures.push('workspace root did not render');
    if (boot.viewportWidth <= 0 || boot.viewportHeight <= 0) {
      failures.push(
        `workspace viewport is not measurable (${boot.viewportWidth}x${boot.viewportHeight})`,
      );
    }
    if (boot.title.trim().length === 0) failures.push('document title is empty');
    if (boot.horizontalOverflow) failures.push('document overflows horizontally at 1440x900');
    if (!keyboard.passed) failures.push(`keyboard focus smoke failed: ${JSON.stringify(keyboard)}`);
    if (consoleErrors.length > 0) failures.push(`console errors: ${consoleErrors.join(' | ')}`);
    if (pageErrors.length > 0) failures.push(`page errors: ${pageErrors.join(' | ')}`);

    const capabilityNotes = [];
    if (capability.capabilityStatus === 'unavailable-in-runner') {
      capabilityNotes.push(
        'This headless runner exposed neither WebGPU nor WebGL. That is recorded as unavailable capability evidence, not converted into a browser-support claim.',
      );
    }

    return {
      engine: engineName,
      browserVersion,
      userAgent: boot.userAgent,
      status: failures.length === 0 ? 'pass' : 'fail',
      boot,
      keyboard,
      capability,
      capabilityNotes,
      failures,
      evidenceBoundary:
        engineName === 'webkit'
          ? 'Playwright WebKit engine evidence only; not shipping Safari or physical Apple-device certification.'
          : 'Playwright browser-engine evidence; not physical-device certification.',
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

buildBundle();
mkdirSync(resultsDir, { recursive: true });
const server = startServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
if (address === null || typeof address === 'string')
  throw new Error('could not resolve smoke server');
const origin = `http://127.0.0.1:${address.port}`;

const results = [];
try {
  for (const engineName of requested) {
    const result = await probe(engineName, origin);
    results.push(result);
    console.log(
      `[browser-matrix] ${result.engine} ${result.browserVersion}: ${result.status.toUpperCase()} | ${result.capability.renderingCapability} (${result.capability.capabilityStatus})`,
    );
    console.log(`  UA: ${result.userAgent}`);
    console.log(`  keyboard: ${result.keyboard.passed ? 'pass' : 'fail'}`);
    console.log(`  evidence: ${result.evidenceBoundary}`);
    for (const note of result.capabilityNotes) console.warn(`  capability: ${note}`);
    for (const failure of result.failures) console.error(`  failure: ${failure}`);
  }
} finally {
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  evidenceType: 'automated-browser-engine-smoke',
  supportClaim:
    'This report records runtime engine capability only. Product support still requires the evidence defined by validation/BROWSER-AND-DEVICE-MATRIX.csv.',
  results,
};
const suffix = requested.length === 1 ? `-${requested[0]}` : '';
const reportPath = path.join(resultsDir, `browser-matrix-smoke${suffix}.json`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[browser-matrix] wrote ${path.relative(repoRoot, reportPath)}`);

if (results.some((result) => result.status !== 'pass')) process.exitCode = 1;
