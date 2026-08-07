#!/usr/bin/env node
/**
 * browser_wall_hud: proves the ARQ Interaction Foundation wall Context HUD
 * against the real production apps/web bundle in real headless Chromium -
 * the full keyboard/pointer/commit contract, not a unit approximation:
 *
 * - the HUD is absent before the wall tool has a placed point and a valid
 *   anchor, and appears during preview (stale-anchor rule, W014);
 * - its placeholder is the live cursor-derived length and tracks pointer
 *   movement;
 * - typing digits on the canvas auto-focuses the HUD's length field and the
 *   digits land there (keyboard-only wall entry, no pointer trip);
 * - CAD letter shortcuts do not leak into the field: 'v'/'w' while typing
 *   neither switch tools nor corrupt the value (input ownership);
 * - Enter with a typed length places the next vertex through the tool's own
 *   placePoint path at exactly the typed distance; Enter with an empty field
 *   finishes the chain through the existing commit path, and the committed
 *   wall's model-tree label carries the exact typed millimetre length;
 * - command feedback ("Wall drawn") appears only after the semantic commit;
 * - invalid text is refused at the field (never reaching a command), a
 *   zero-length place is refused by the same dedupe rule clicks obey, and
 *   repeated Enter never duplicates a placement;
 * - Escape follows the tool's three-tier rule: clear typed text first, then
 *   pop the placed point (closing the HUD);
 * - Ctrl+Z / Ctrl+Shift+Z undo and redo the committed wall (the registry's
 *   own bindings, driven end to end);
 * - wheel over the HUD does not zoom the viewport, wheel over the canvas
 *   still does (wheel ownership);
 * - under prefers-reduced-motion the whole flow still works - motion removal
 *   never removes function;
 * - zero console errors throughout.
 *
 * Usage: node scripts/run-wall-hud-capability-check.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** Same sandbox-then-CI browser resolution as every other capability check. */
function resolveChromiumExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined;
}

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
  return createServer((req, res) => {
    const relative = (req.url === '/' ? '/index.html' : req.url).split('?')[0];
    const filePath = path.join(distDir, relative);
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const contents = readFileSync(filePath);
      res.writeHead(200, {
        'content-type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      });
      res.end(contents);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
}

const HUD = '[data-testid="arq-wall-hud"]';
const HUD_INPUT = '#arq-wall-length-input';

function countWallRows(page, lengthMm) {
  return page.evaluate(
    (expected) =>
      [...document.querySelectorAll('[role="treeitem"]')].filter((row) =>
        (row.textContent ?? '').includes(`Wall ${expected} mm (drawn)`),
      ).length,
    lengthMm,
  );
}

function feedbackTexts(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.arq-command-feedback__entry')].map(
      (entry) => entry.textContent ?? '',
    ),
  );
}

/** The status bar's view-scale span is the one matching /^\d+%$/. */
/**
 * The view's scale, from the drawing's own identity chip.
 *
 * This used to read a `NN%` zoom span out of the status strip. The strip
 * carries the two fields that are guarantees now, and the zoom readout moved to
 * the chip on the sheet's corner, where it reads as a drawing scale - "1:74" -
 * rather than as a percentage of nothing in particular.
 *
 * Returns null rather than undefined when it finds nothing, because the caller
 * has to be able to tell "the view did not zoom" from "the readout is not on
 * screen". Comparing two undefineds is how the wheel-over-the-HUD half of this
 * check came to pass without observing anything at all.
 */
function readViewScale(page) {
  return page.evaluate(() => {
    const chip = document.querySelector('.arq-view-identity');
    const match = /1:\d+/.exec(chip?.textContent ?? '');
    return match === null ? null : match[0];
  });
}

async function poll(page, predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) return false;
    await page.waitForTimeout(50);
  }
}

/** Runs the basic keyboard flow: w, place a point, move, type a length, Enter (place), Enter (commit). */
async function runNumericWallFlow(page, box, lengthText, lengthMm, yFraction) {
  await page.keyboard.press('w');
  const y = box.y + box.height * yFraction;
  await page.mouse.move(box.x + box.width * 0.25, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.mouse.move(box.x + box.width * 0.45, y);
  await poll(page, () =>
    page
      .locator(HUD)
      .count()
      .then((count) => count > 0),
  );
  await page.keyboard.type(lengthText);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  return poll(page, async () => (await countWallRows(page, lengthMm)) >= 1);
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
    // Desktop layout band: model tree, tool rail, status bar all docked.
    const page = await browser.newPage({ viewport: { width: 1536, height: 900 } });
    const consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForSelector('.arq-shell-button', { timeout: 10_000 });
    await page.waitForFunction(
      () => document.querySelector('.arq-status-bar')?.textContent?.includes('Journal current'),
      undefined,
      { timeout: 10_000 },
    );

    const planCanvas = page.locator('canvas[aria-label="Plan canvas"]');
    const box = await planCanvas.boundingBox();
    if (box === null) throw new Error('plan canvas has no bounding box');
    const midY = box.y + box.height * 0.35;

    // --- HUD lifecycle: absent before a placed point, present during preview.
    await page.keyboard.press('w');
    const crosshairArmed = await poll(
      page,
      async () => (await planCanvas.evaluate((el) => getComputedStyle(el).cursor)) === 'crosshair',
    );
    await page.mouse.move(box.x + box.width * 0.3, midY);
    const hudHiddenBeforeFirstPoint = (await page.locator(HUD).count()) === 0;

    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(box.x + box.width * 0.5, midY);
    const hudVisibleDuringPreview = await poll(page, () =>
      page
        .locator(HUD)
        .isVisible()
        .catch(() => false),
    );

    // --- Placeholder tracks the live cursor-derived length.
    const placeholderA = await page.locator(HUD_INPUT).getAttribute('placeholder');
    await page.mouse.move(box.x + box.width * 0.58, midY);
    const placeholderTracksPointer = await poll(page, async () => {
      const placeholderB = await page.locator(HUD_INPUT).getAttribute('placeholder');
      return placeholderB !== null && placeholderB !== placeholderA;
    });

    // --- Digits typed on the canvas land in the auto-focused field.
    await page.keyboard.type('1500');
    const digitsAutoFocus =
      (await page.locator(HUD_INPUT).inputValue()) === '1500' &&
      (await page.evaluate(() => document.activeElement?.id)) === 'arq-wall-length-input';

    // --- Letter shortcuts must not leak out of the field.
    await page.keyboard.press('v');
    await page.keyboard.press('w');
    const shortcutsDoNotLeak =
      (await page.locator(HUD_INPUT).inputValue()) === '1500' &&
      (await planCanvas.evaluate((el) => getComputedStyle(el).cursor)) === 'crosshair';

    // --- Enter places at the exact typed length; empty Enter commits.
    await page.keyboard.press('Enter');
    const inputClearedAfterPlace = await poll(
      page,
      async () => (await page.locator(HUD_INPUT).inputValue()) === '',
    );
    await page.keyboard.press('Enter');
    const numericCommitExactLength = await poll(
      page,
      async () => (await countWallRows(page, 1500)) === 1,
    );
    const feedbackAfterCommit = await poll(page, async () =>
      (await feedbackTexts(page)).some((text) => text.includes('Wall drawn')),
    );

    // --- Undo / redo through the registry's own keyboard bindings.
    await page.keyboard.press('Control+z');
    const undoRemovesWall = await poll(page, async () => (await countWallRows(page, 1500)) === 0);
    await page.keyboard.press('Control+Shift+z');
    const redoRestoresWall = await poll(page, async () => (await countWallRows(page, 1500)) === 1);

    // --- Invalid text refused at the field; Escape tiers; zero-length refusal;
    //     repeated Enter places once.
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
    await poll(page, () =>
      page
        .locator(HUD)
        .isVisible()
        .catch(() => false),
    );
    await page.keyboard.type('99');
    await page.keyboard.type('x');
    const invalidInputRefused = (await page.locator(HUD_INPUT).inputValue()) === '99';

    await page.keyboard.press('Escape');
    const escapeTierClearsTextFirst =
      (await page.locator(HUD_INPUT).inputValue()) === '' &&
      (await page.locator(HUD).count()) === 1;
    await page.keyboard.press('Escape');
    const escapeTierPopsPoint = await poll(
      page,
      async () => (await page.locator(HUD).count()) === 0,
    );

    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.75);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.75);
    await poll(page, () =>
      page
        .locator(HUD)
        .isVisible()
        .catch(() => false),
    );
    await page.keyboard.type('0');
    await page.keyboard.press('Enter');
    // A zero place is refused by the same <0.5mm dedupe rule clicks obey: the
    // draft still has exactly its first point, so the HUD stays open.
    const zeroLengthRefused = (await page.locator(HUD).count()) === 1;
    // The refused zero stays in the field by design (no placePoint, no
    // reset) - replace it wholesale, the select-all-and-retype path.
    await page.locator(HUD_INPUT).fill('800');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    const singlePlacePerEnter = await poll(
      page,
      async () => (await countWallRows(page, 800)) === 1,
    );

    // --- Wheel ownership: over the HUD nothing zooms; over the canvas it does.
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.2);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.2);
    await poll(page, () =>
      page
        .locator(HUD)
        .isVisible()
        .catch(() => false),
    );
    const scaleBefore = await readViewScale(page);
    if (scaleBefore === null) {
      throw new Error(
        'the view scale readout is not on screen, so no zoom assertion here means anything',
      );
    }
    // The HUD surface is pointer-transparent by design; the numeric FIELD is
    // the element that owns the pointer again, and the ownership rule is
    // about exactly it: wheel over the field must not alter the model.
    const inputBox = await page.locator(HUD_INPUT).boundingBox();
    if (inputBox === null) throw new Error('HUD input has no bounding box');
    await page.mouse.move(inputBox.x + inputBox.width / 2, inputBox.y + inputBox.height / 2);
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(120);
    const wheelOverHudDoesNotZoom = (await readViewScale(page)) === scaleBefore;
    await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6);
    await page.mouse.wheel(0, -240);
    const wheelOverCanvasZooms = await poll(
      page,
      async () => (await readViewScale(page)) !== scaleBefore,
    );
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    // --- Reduced motion: the whole numeric flow still works.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.waitForSelector('.arq-shell-button', { timeout: 10_000 });
    await page.waitForFunction(
      () => document.querySelector('.arq-status-bar')?.textContent?.includes('Journal current'),
      undefined,
      { timeout: 10_000 },
    );
    const reducedMotionFlowWorks = await runNumericWallFlow(page, box, '500', 500, 0.5);

    const results = {
      crosshairArmed,
      hudHiddenBeforeFirstPoint,
      hudVisibleDuringPreview,
      placeholderTracksPointer,
      digitsAutoFocus,
      shortcutsDoNotLeak,
      inputClearedAfterPlace,
      numericCommitExactLength,
      feedbackAfterCommit,
      undoRemovesWall,
      redoRestoresWall,
      invalidInputRefused,
      escapeTierClearsTextFirst,
      escapeTierPopsPoint,
      zeroLengthRefused,
      singlePlacePerEnter,
      wheelOverHudDoesNotZoom,
      wheelOverCanvasZooms,
      reducedMotionFlowWorks,
    };
    const ok = Object.values(results).every(Boolean) && consoleErrors.length === 0;

    const payload = {
      timestamp: new Date().toISOString(),
      environment: `headless Chromium ${await browser.version()}, real production apps/web build served over HTTP`,
      evidenceId: 'browser_wall_hud',
      ok,
      ...results,
      consoleErrors,
    };
    const resultsDir = path.join(repoRoot, 'benchmarks/results');
    mkdirSync(resultsDir, { recursive: true });
    const stamp = payload.timestamp.replace(/[:.]/g, '-');
    const outPath = path.join(resultsDir, `wall-hud-capability-${stamp}.json`);
    writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
    console.log(JSON.stringify(payload, null, 2));
    console.log(`\nSaved to ${path.relative(repoRoot, outPath)}`);
    if (!ok) process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
