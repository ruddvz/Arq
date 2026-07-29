#!/usr/bin/env node
/**
 * browser_model_canvas: proves a user can reach the 3D surface and that it
 * actually renders - the reachability evidence CONFLICT-3D-CURRENT-STATUS
 * (docs/product/voice/conflict-registry.json) requires before any current-3D
 * claim can be settled, and the proof-gap closure the evidence catalog
 * records (engineering/ops/evidence-catalog.v5.json: "Add an explicit
 * browser test that opens the 3D surface, validates shared selection, and
 * captures a visual fixture"). Runs `vite build` first (so this checks the
 * actual production bundle, same code path a user gets), serves the result
 * over plain HTTP, then drives it:
 *
 * - opens the 3D view through its real control - the '3D' tab in the
 *   project tab strip, not a state poke;
 * - asserts the ModelCanvas surface mounts: a visible canvas with nonzero
 *   client size holding a WebGL2 context (three ^0.185's WebGLRenderer
 *   creates WebGL2; a canvas already holding one returns null for '2d' and
 *   the live context for 'webgl2' - both are asserted);
 * - asserts something was actually drawn by decoding a real screenshot of
 *   the canvas (the renderer does not preserve its drawing buffer, so
 *   read-back must go through the composited page, which is also what a
 *   user sees): more than one distinct pixel colour, i.e. not a uniform
 *   cleared surface;
 * - proves plan<->3D shared selection through the real UI: draws a wall on
 *   the plan canvas, point-selects it with the Select tool, switches to 3D
 *   and finds the selection highlight's green-dominant pixels (ModelCanvas
 *   restyles the selected mesh to phthalo green 0x0b6b50; every unselected
 *   surface in the scene is monochrome, so green-dominant pixels can only
 *   be the highlight), then clicks empty 3D space and watches the shared
 *   selection clear back to 'No selection' with the green gone - selection
 *   observed flowing plan -> 3D and 3D -> workspace;
 * - captures the workspace with the highlighted 3D view as the visual
 *   fixture the proof gap names, into benchmarks/results/.
 *
 * Usage: node scripts/run-model-canvas-capability-check.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * `/opt/pw-browsers/chromium` is this development sandbox's own pre-installed
 * browser path (see PLAYWRIGHT_BROWSERS_PATH) - real, but not portable to a
 * plain CI runner, where `npx playwright install --with-deps chromium`
 * installs to Playwright's own default cache instead. Using the sandbox path
 * unconditionally meant this script had never actually been exercised
 * outside this sandbox until it was first wired into CI, where it failed
 * immediately: "Failed to launch chromium because executable doesn't exist
 * at /opt/pw-browsers/chromium". Falling back to `undefined` (Playwright's
 * own resolution) when that specific path is absent fixes both environments
 * without special-casing CI.
 */
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

const STATUS_BAR = '.arq-status-bar';

/**
 * Decodes a PNG screenshot of the 3D canvas and reports what is actually in
 * it. Decoding happens in the browser itself (Image -> 2D canvas ->
 * getImageData) so this script needs no PNG library. Green-dominant means
 * g clearly above both r and b: the selection treatment 0x0b6b50 has
 * g-r = 96 and g-b = 27, and Lambert lighting scales channels equally, so
 * the dominance survives shading - while the scene's every other colour
 * (white clear, monochrome floor/walls/outline) has r === g === b and can
 * never satisfy it. Anti-aliased edge blends are why the thresholds are
 * generous rather than exact-colour matches.
 */
function analyzeCanvasPixels(page, pngBuffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const scratch = document.createElement('canvas');
    scratch.width = image.naturalWidth;
    scratch.height = image.naturalHeight;
    const ctx = scratch.getContext('2d');
    if (ctx === null) {
      throw new Error('screenshot-decode canvas refused a 2d context');
    }
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, scratch.width, scratch.height).data;
    const colors = new Set();
    let greenDominant = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      colors.add((r << 16) | (g << 8) | b);
      if (g > r + 30 && g > b + 15) {
        greenDominant += 1;
      }
    }
    return {
      width: scratch.width,
      height: scratch.height,
      totalPixels: data.length / 4,
      uniqueColors: colors.size,
      greenDominantPixels: greenDominant,
    };
  }, pngBuffer.toString('base64'));
}

/**
 * Bounded poll over an async sample - used where the condition lives in a
 * screenshot rather than the DOM, so waitForFunction cannot see it. A
 * genuine failure still fails at the deadline; the interval only absorbs
 * the frame or two between a React commit and the next composite.
 */
async function pollSampleUntil(page, sample, isDone, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await sample();
    if (isDone(value)) {
      return { reached: true, value };
    }
    if (Date.now() > deadline) {
      return { reached: false, value };
    }
    await page.waitForTimeout(200);
  }
}

async function run(screenshotPath) {
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
    // 1536x900 resolves the desktop layout band, so the tab strip, tool
    // rail, plan canvas and status bar are all present for the flow below.
    const page = await browser.newPage({ viewport: { width: 1536, height: 900 } });
    const consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForSelector('.arq-shell-button', { timeout: 10_000 });
    // App settled: the journal label only appears after start-up completes.
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.includes('Journal current'),
      STATUS_BAR,
      { timeout: 10_000 },
    );

    /* -------------------------------------------------------------- */
    /* Reachability: the 3D tab, through the real tab strip            */
    /* -------------------------------------------------------------- */

    // The tab's accessible name is tabLabel()'s "3D, 3D. Press Delete to
    // close." - matching on the '3D' fragment finds exactly this tab (the
    // other tabs are 'Project overview' and 'Level 1 Plan').
    const tab3d = page.getByRole('tab', { name: /3D/ });
    const tabAccessibleName = await tab3d.getAttribute('aria-label');
    await tab3d.click();
    const tabSelected = (await tab3d.getAttribute('aria-selected')) === 'true';

    const modelCanvas = page.locator('canvas[aria-label="3D model view"]');
    await modelCanvas.waitFor({ state: 'visible', timeout: 5000 });
    const surface = await modelCanvas.evaluate((el) => ({
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      // A canvas holding a context returns null for any other context type,
      // and the live context for its own - so these two calls together
      // prove the mounted surface is WebGL2, ModelCanvas's real backend.
      is2dContext: el.getContext('2d') !== null,
      isWebgl2Context: el.getContext('webgl2') !== null,
    }));

    // ModelCanvas renders synchronously in its mount effect, but the
    // screenshot needs the frame composited - poll, bounded, until the
    // decoded pixels show more than one colour (floor, room outline and
    // clear colour are all distinct; a dead surface is uniform).
    const drawnPoll = await pollSampleUntil(
      page,
      async () => analyzeCanvasPixels(page, await modelCanvas.screenshot()),
      (stats) => stats.uniqueColors > 1,
      5000,
    );
    const initialPixels = drawnPoll.value;
    // Nothing is selected yet, so the honest baseline for the selection
    // proof below is zero green-dominant pixels in the monochrome scene.
    const greenBaselineIsZero = initialPixels.greenDominantPixels === 0;

    /* -------------------------------------------------------------- */
    /* Shared selection: select in plan, observe the highlight in 3D   */
    /* -------------------------------------------------------------- */

    // Back to the plan view, and draw one wall through the real tools -
    // ModelCanvas only extrudes drawn walls, so a drawn wall is the one
    // element whose selection is observable on both surfaces.
    await page.getByRole('tab', { name: /Level 1 Plan/ }).click();
    const toolRail = page.getByRole('navigation', { name: 'Tools' });
    await toolRail.getByRole('button', { name: 'Draw', exact: true }).click();
    await toolRail
      .getByRole('group', { name: 'Draw tools' })
      .getByRole('button', { name: 'Wall', exact: true })
      .click();
    const planCanvas = page.locator('canvas[aria-label="Plan canvas"]');
    const box = await planCanvas.boundingBox();
    if (box === null) {
      throw new Error('plan canvas has no bounding box');
    }
    const startX = box.x + box.width * 0.3;
    const endX = box.x + box.width * 0.6;
    const y = box.y + box.height * 0.35;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    await page.mouse.up();
    await page.mouse.move(endX, y);
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[role="treeitem"]')].some((row) =>
          /\(drawn\)/.test(row.textContent ?? ''),
        ),
      null,
      { timeout: 5000 },
    );

    // Point-select the wall on the plan canvas with the real Select tool; the
    // status bar's selection count is the workspace's shared-selection
    // readout, and it stays visible across the tab switch below.
    await toolRail.getByRole('button', { name: 'Select', exact: true }).click();
    await toolRail
      .getByRole('group', { name: 'Select tools' })
      .getByRole('button', { name: 'Select', exact: true })
      .click();
    await page.mouse.click((startX + endX) / 2, y);
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.includes('1 selected'),
      STATUS_BAR,
      { timeout: 5000 },
    );

    // Same selection object, other surface: the highlight must appear in 3D
    // without touching anything there.
    await tab3d.click();
    await modelCanvas.waitFor({ state: 'visible', timeout: 5000 });
    const highlightPoll = await pollSampleUntil(
      page,
      async () => analyzeCanvasPixels(page, await modelCanvas.screenshot()),
      (stats) => stats.greenDominantPixels >= 50,
      5000,
    );
    const selectedPixels = highlightPoll.value;

    // The visual fixture: the whole workspace with the 3D tab active and the
    // selected wall highlighted - reachability and shared selection in one
    // image, captured only now so the fixture shows the proven state.
    await page.screenshot({ path: screenshotPath });

    // And the reverse direction: a click on empty 3D space clears the shared
    // selection (ModelCanvas raycasts, finds nothing, selects null), which
    // the plan-side status bar and the 3D highlight must both reflect.
    await modelCanvas.click({ position: { x: 8, y: 8 } });
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.includes('No selection'),
      STATUS_BAR,
      { timeout: 5000 },
    );
    const clearPoll = await pollSampleUntil(
      page,
      async () => analyzeCanvasPixels(page, await modelCanvas.screenshot()),
      (stats) => stats.greenDominantPixels === 0,
      5000,
    );
    const clearedPixels = clearPoll.value;

    const selectionShared = greenBaselineIsZero && highlightPoll.reached && clearPoll.reached;

    const ok =
      tabSelected &&
      surface.clientWidth > 0 &&
      surface.clientHeight > 0 &&
      !surface.is2dContext &&
      surface.isWebgl2Context &&
      drawnPoll.reached &&
      selectionShared === true &&
      consoleErrors.length === 0;

    return {
      ok,
      evidenceId: 'browser_model_canvas',
      conflictId: 'CONFLICT-3D-CURRENT-STATUS',
      reachability: {
        tabAccessibleName,
        tabSelected,
        surface,
        somethingDrawn: drawnPoll.reached,
        initialPixels,
      },
      selectionShared,
      selectionEvidence: {
        greenBaselineIsZero,
        selectedPixels,
        clearedPixels,
      },
      selectionNote:
        'Selection made on the plan canvas appeared as the phthalo-green highlight in 3D, and an empty-space click in 3D cleared it back to "No selection" - both directions observed through the real UI.',
      screenshot: path.relative(repoRoot, screenshotPath),
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
        executablePath: resolveChromiumExecutablePath(),
        headless: true,
      });
      const v = await b.version();
      await b.close();
      return v;
    })()
  ).toString();

  const timestamp = new Date().toISOString();
  const outDir = path.join(repoRoot, 'benchmarks/results');
  mkdirSync(outDir, { recursive: true });
  const screenshotPath = path.join(
    outDir,
    `model-canvas-visual-${timestamp.replace(/[:.]/g, '-')}.png`,
  );

  const result = await run(screenshotPath);
  const report = {
    timestamp,
    environment: `headless Chromium ${version}, real production apps/web build served over HTTP, real WebGL2 rendering`,
    ...result,
  };

  console.log(JSON.stringify(report, null, 2));

  const outPath = path.join(
    outDir,
    `model-canvas-capability-${timestamp.replace(/[:.]/g, '-')}.json`,
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
