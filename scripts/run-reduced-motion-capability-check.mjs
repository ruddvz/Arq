#!/usr/bin/env node
/**
 * UX-8.3: browser evidence that the built editor honours reduced motion
 * without changing functional state semantics.
 *
 * This check intentionally drives the production apps/web bundle. It proves:
 * - the OS preference reaches CSS media queries in Chromium;
 * - shared shell duration tokens resolve to effectively immediate values;
 * - the refraction-slot transition is removed even when the real optical
 *   quality policy does not choose refraction on this runner;
 * - modal presentation loses its decorative animation but still opens/closes;
 * - rapid view-kind changes settle on the last requested state.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

function resolveChromiumExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const webDir = path.join(repoRoot, 'apps/web');
const distDir = path.join(webDir, 'dist');
const resultsDir = path.join(repoRoot, 'benchmarks/results');
const resultPath = path.join(resultsDir, 'reduced-motion.json');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

function startServer() {
  const server = createServer((req, res) => {
    const relative = (req.url === '/' ? '/index.html' : req.url).split('?')[0];
    const filePath = path.join(distDir, relative);
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const contents = readFileSync(filePath);
      const ext = path.extname(filePath);
      res.writeHead(200, { 'content-type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(contents);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return server;
}

function record(result) {
  mkdirSync(resultsDir, { recursive: true });
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
}

async function run() {
  execFileSync('npx', ['vite', 'build'], { cwd: webDir, stdio: 'inherit' });
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('vite build did not produce apps/web/dist/index.html');
  }

  const server = startServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForSelector('.arq-shell-button', { timeout: 10_000 });

    const reducedMotionMatches = await page.evaluate(() =>
      matchMedia('(prefers-reduced-motion: reduce)').matches,
    );

    const motionTokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        micro: style.getPropertyValue('--arq-motion-micro').trim(),
        fast: style.getPropertyValue('--arq-motion-fast').trim(),
        normal: style.getPropertyValue('--arq-motion-normal').trim(),
        deliberate: style.getPropertyValue('--arq-motion-deliberate').trim(),
        legacyFast: style.getPropertyValue('--arq-motion-duration-fast').trim(),
        legacyEase: style.getPropertyValue('--arq-motion-ease-standard').trim(),
      };
    });
    const durationTokensReduced =
      motionTokens.micro === '1ms' &&
      motionTokens.fast === '1ms' &&
      motionTokens.normal === '1ms' &&
      motionTokens.deliberate === '1ms' &&
      motionTokens.legacyFast === '1ms';
    const legacyEaseBridged = motionTokens.legacyEase.length > 0;

    const refractionTransition = await page.evaluate(() => {
      const probe = document.createElement('span');
      probe.className = 'arq-refraction-lens__slot';
      probe.setAttribute('aria-hidden', 'true');
      document.body.append(probe);
      const style = getComputedStyle(probe);
      const result = {
        property: style.transitionProperty,
        duration: style.transitionDuration,
      };
      probe.remove();
      return result;
    });
    const refractionMotionRemoved =
      refractionTransition.property === 'none' || refractionTransition.duration === '0s';

    const commandButton = page.getByRole('button', { name: /command|search/i }).first();
    await commandButton.click();
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    const modalAnimation = await page.evaluate(() => {
      const backdrop = document.querySelector('.arq-modal-overlay');
      if (backdrop === null) return null;
      const style = getComputedStyle(backdrop);
      return { name: style.animationName, duration: style.animationDuration };
    });
    const modalMotionRemoved =
      modalAnimation !== null &&
      (modalAnimation.name === 'none' || modalAnimation.duration === '0s');
    const dialogUsableWithoutMotion = await dialog.getByRole('combobox').isVisible();
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });

    const viewTabs = page.locator(
      '[role="tablist"][aria-label="View kind"] [role="tab"]:not(:disabled)',
    );
    const viewTabCount = await viewTabs.count();
    let rapidStateSettled = true;
    let finalViewLabel = null;
    if (viewTabCount >= 2) {
      const first = viewTabs.nth(0);
      const second = viewTabs.nth(1);
      await first.click();
      await second.click();
      await first.click();
      rapidStateSettled = (await first.getAttribute('aria-selected')) === 'true';
      finalViewLabel = await first.textContent();
    }

    const result = {
      reducedMotionMatches,
      durationTokensReduced,
      legacyEaseBridged,
      refractionMotionRemoved,
      modalMotionRemoved,
      dialogUsableWithoutMotion,
      rapidStateSettled,
      viewTabCount,
      finalViewLabel,
      motionTokens,
      refractionTransition,
      modalAnimation,
      consoleErrors,
    };
    record(result);

    const ok =
      reducedMotionMatches &&
      durationTokensReduced &&
      legacyEaseBridged &&
      refractionMotionRemoved &&
      modalMotionRemoved &&
      dialogUsableWithoutMotion &&
      rapidStateSettled &&
      consoleErrors.length === 0;

    if (!ok) {
      throw new Error(`reduced-motion capability check failed: ${JSON.stringify(result)}`);
    }

    process.stdout.write(
      `reduced-motion capability check passed: ${JSON.stringify(result)}\n`,
    );
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  record({ error: error instanceof Error ? error.message : String(error) });
  console.error(error);
  process.exitCode = 1;
});
