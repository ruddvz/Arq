#!/usr/bin/env node
/**
 * UI-003: proves ArqModalDialog's overlay/focus contract against a real,
 * built apps/web bundle in real headless Chromium, not by inspecting the
 * source and assuming React Aria's behaviour holds. Runs `vite build` first
 * (so this checks the actual production bundle, same code path a user gets),
 * serves the result over plain HTTP, then drives it:
 *
 * - opens the command palette through its real trigger button;
 * - confirms focus moved into the dialog (not left on the trigger, not lost
 *   to the document body);
 * - confirms a real focus trap - repeated Tab presses never move focus
 *   outside the dialog into the background shell;
 * - confirms Escape closes the dialog and returns focus to the exact
 *   trigger element, not merely "some focusable element";
 * - confirms an outside click does the same, proving both close paths
 *   restore focus, not just one;
 * - confirms the shell's own control styling (shell-controls.css) is
 *   actually applied to a real button in the built bundle, catching the
 *   class of bug where a stylesheet exists but nothing imports it.
 *
 * Usage: node scripts/run-design-system-dialog-capability-check.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const webDir = path.join(repoRoot, 'apps/web');
const distDir = path.join(webDir, 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
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

async function run() {
  execFileSync('npx', ['vite', 'build'], { cwd: webDir, stdio: 'inherit' });
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('vite build did not produce apps/web/dist/index.html');
  }

  const server = startServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForSelector('.arq-shell-button', { timeout: 10_000 });

    const shellButtonComputedStyle = await page
      .locator('.arq-shell-button')
      .first()
      .evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          minHeight: style.minHeight,
          borderRadius: style.borderRadius,
          cursor: style.cursor,
        };
      });
    // 44px is the real, documented touch-target token (--arq-touch-target-min).
    // Any other value means shell-controls.css did not actually apply - a
    // stylesheet existing on disk but never imported is silent in every other
    // check (typecheck and unit tests do not render anything).
    const shellControlsCssApplied = shellButtonComputedStyle.minHeight === '44px';

    const commandButton = page.getByRole('button', { name: /command|search/i }).first();
    await commandButton.click();
    const dialog = page.getByRole('dialog', { name: 'Command palette' });
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    const activeElementAfterOpen = await page.evaluate(() => {
      const el = document.activeElement;
      return { tag: el?.tagName ?? null, role: el?.getAttribute('role') ?? null };
    });
    const focusMovedIntoDialog =
      activeElementAfterOpen.tag === 'INPUT' && activeElementAfterOpen.role === 'combobox';

    const tabStopsInsideDialog = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      tabStopsInsideDialog.push(
        await page.evaluate(() => {
          const dialogEl = document.querySelector('[role="dialog"]');
          return dialogEl !== null && dialogEl.contains(document.activeElement);
        }),
      );
    }
    const focusTrapHeld = tabStopsInsideDialog.every(Boolean);

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    const focusReturnedAfterEscape = await commandButton.evaluate(
      (el) => el === document.activeElement,
    );

    await commandButton.click();
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    await page.mouse.click(10, 10);
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });
    const focusReturnedAfterOutsideClick = await commandButton.evaluate(
      (el) => el === document.activeElement,
    );

    const ok =
      shellControlsCssApplied &&
      focusMovedIntoDialog &&
      focusTrapHeld &&
      focusReturnedAfterEscape &&
      focusReturnedAfterOutsideClick &&
      consoleErrors.length === 0;

    return {
      ok,
      shellButtonComputedStyle,
      shellControlsCssApplied,
      focusMovedIntoDialogOnOpen: focusMovedIntoDialog,
      tabStopCount: tabStopsInsideDialog.length,
      focusTrapHeld,
      focusReturnedToTriggerAfterEscape: focusReturnedAfterEscape,
      focusReturnedToTriggerAfterOutsideClick: focusReturnedAfterOutsideClick,
      consoleErrors,
    };
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  const version = (
    await (async () => {
      const b = await chromium.launch({
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
        headless: true,
      });
      const v = await b.version();
      await b.close();
      return v;
    })()
  ).toString();

  const result = await run();
  const report = {
    timestamp: new Date().toISOString(),
    environment: `headless Chromium ${version}, real production apps/web build served over HTTP`,
    ...result,
  };

  console.log(JSON.stringify(report, null, 2));

  const outDir = path.join(repoRoot, 'benchmarks/results');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `design-system-dialog-capability-${report.timestamp.replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nSaved to ${path.relative(repoRoot, outPath)}`);

  if (!report.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
