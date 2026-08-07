/**
 * Does the page fit on screen, and does its chrome stay off the drawing?
 *
 * Two properties that are easy to assert in the abstract and were both false
 * in the build. The sheet is painted into the canvas rather than laid out, so
 * no DOM assertion can see it: the only honest way to ask where the page is
 * and where the drawing's ink starts is to read the pixels the renderer
 * actually produced.
 *
 * What it caught, and what it exists to stop coming back:
 *
 * - The fit fitted the drawing, and the sheet is drawn six per cent outside
 *   the drawing. So the page ran off the top and bottom of the canvas at every
 *   viewport. The surface was visible to the left and right of the page and
 *   never above or below it, which reads as a drawing cropped by the window
 *   rather than a page lying on a desk.
 * - Because the sheet's top edge was above the canvas, the view's title had no
 *   edge to straddle and clamped to the canvas top instead. At 1024x768 that
 *   put it seven pixels over the drawing's top wall - the same defect as a room
 *   label struck through by a wall, moved to a different piece of chrome.
 *
 * Limits, stated because this is evidence: Chromium only, one fixture, and the
 * ink test reads a single column beneath the title rather than the whole
 * drawing. It proves the title clears the ink under it; it does not prove no
 * other chrome clears every mark on the page.
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'apps/web/dist');
const outDir = path.join(repoRoot, 'benchmarks/results');
const fixturePath = path.join(repoRoot, 'fixtures/ARQ_Courtyard_House_Golden_Fixture_v2.arq');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

/** The bands the work is captured at, which is where it has to be right. */
const VIEWPORTS = [
  { name: 'desktop', width: 1600, height: 1000 },
  { name: 'ipad-regular', width: 1366, height: 1024 },
  { name: 'ipad-compact', width: 1024, height: 768 },
];

function startServer() {
  const server = createServer((request, response) => {
    const requested = (request.url ?? '/').split('?')[0];
    let filePath = path.join(distDir, decodeURIComponent(requested));
    if (!existsSync(filePath) || !path.extname(filePath)) {
      filePath = path.join(distDir, 'index.html');
    }
    response.setHeader('Content-Type', MIME_TYPES[path.extname(filePath)] ?? 'text/plain');
    response.end(readFileSync(filePath));
  });
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

async function openFixture(page, file) {
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  await page.getByRole('dialog').waitFor({ timeout: 15_000 });
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.waitForFunction(
    () => (document.body.textContent ?? '').includes('Courtyard House Reference'),
    undefined,
    { timeout: 120_000 },
  );
}

/** Reads the page and the drawing out of the rendered canvas. */
async function measure(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const chip = document.querySelector('.arq-view-identity');
    if (canvas === null || chip === null) return null;

    const canvasBox = canvas.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    const ratio = canvas.width / canvasBox.width;
    const context = canvas.getContext('2d');

    /*
     * A column straight down through the middle of the title.
     *
     * The question is only ever local: does *this* chrome cover the ink
     * beneath it. A column under the title answers exactly that, and answers
     * it in the renderer's own output rather than from the model.
     */
    const column = Math.round((chipBox.left + chipBox.width / 2 - canvasBox.left) * ratio);
    const pixels = context.getImageData(column, 0, 1, canvas.height).data;
    const luminance = (row) =>
      0.299 * pixels[row * 4] + 0.587 * pixels[row * 4 + 1] + 0.114 * pixels[row * 4 + 2];

    // The page is plain paper; the surface it lies on carries a grid.
    const PAPER = 250;
    const INK = 120;

    let sheetTop = null;
    let inkTop = null;
    for (let row = 0; row < canvas.height; row += 1) {
      const value = luminance(row);
      if (sheetTop === null && value > PAPER) sheetTop = row;
      if (sheetTop !== null && inkTop === null && value < INK) {
        inkTop = row;
        break;
      }
    }

    let sheetBottom = null;
    for (let row = canvas.height - 1; row >= 0; row -= 1) {
      if (luminance(row) > PAPER) {
        sheetBottom = row;
        break;
      }
    }

    const toCss = (value) => (value === null ? null : Math.round(value / ratio));
    return {
      canvasHeight: Math.round(canvasBox.height),
      sheetTop: toCss(sheetTop),
      sheetBottom: toCss(sheetBottom),
      inkTop: toCss(inkTop),
      chipTop: Math.round(chipBox.top - canvasBox.top),
      chipBottom: Math.round(chipBox.bottom - canvasBox.top),
      chipLeft: Math.round(chipBox.left - canvasBox.left),
    };
  });
}

async function main() {
  execFileSync('pnpm', ['--filter', '@arq/web', 'build'], { cwd: repoRoot, stdio: 'inherit' });
  const { server, port } = await startServer();
  const browser = await chromium.launch({
    ...(existsSync('/opt/pw-browsers/chromium')
      ? { executablePath: '/opt/pw-browsers/chromium' }
      : {}),
  });

  const rows = [];
  const failures = [];

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    await page.goto(`http://localhost:${port}/`);
    await openFixture(page, fixturePath);
    await page.waitForTimeout(2000);

    const measured = await measure(page);
    if (measured === null) {
      failures.push(`${viewport.name}: no canvas or no view title on the page`);
      await context.close();
      continue;
    }
    rows.push({ viewport: viewport.name, ...measured });

    if (measured.sheetTop === null || measured.sheetBottom === null) {
      failures.push(`${viewport.name}: no page found in the canvas at all`);
      await context.close();
      continue;
    }

    // The page has to be on the desk, not cropped by the window.
    if (measured.sheetTop <= 0) {
      failures.push(
        `${viewport.name}: the page runs off the top of the canvas (sheet top ${measured.sheetTop})`,
      );
    }
    if (measured.sheetBottom >= measured.canvasHeight - 1) {
      failures.push(
        `${viewport.name}: the page runs off the bottom of the canvas (sheet bottom ${measured.sheetBottom} of ${measured.canvasHeight})`,
      );
    }

    // The title straddles the page's corner; it must not be sitting on the
    // drawing, which is the whole reason it was moved off the canvas centre.
    if (measured.inkTop !== null && measured.chipBottom > measured.inkTop) {
      failures.push(
        `${viewport.name}: the view title covers the drawing by ${measured.chipBottom - measured.inkTop}px (title ends ${measured.chipBottom}, ink starts ${measured.inkTop})`,
      );
    }
    if (measured.chipTop < 0 || measured.chipLeft < 0) {
      failures.push(`${viewport.name}: the view title is pushed outside the canvas`);
    }

    await context.close();
  }

  await browser.close();
  server.close();

  const report = {
    generatedFrom: 'scripts/run-sheet-chrome-capability-check.mjs',
    fixture: path.relative(repoRoot, fixturePath),
    rows,
    failures,
    ok: failures.length === 0,
    limitation:
      'Chromium only, one fixture, and the ink test reads a single column beneath the view title. It proves the page fits and the title clears the ink under it; it proves nothing about other engines or about chrome elsewhere on the page.',
  };

  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `sheet-chrome-capability-${Date.now()}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);

  for (const row of rows) {
    const clearance = row.inkTop === null ? null : row.inkTop - row.chipBottom;
    console.log(
      `${row.viewport.padEnd(14)} page ${String(row.sheetTop).padStart(4)}..${String(row.sheetBottom).padEnd(4)} of ${String(row.canvasHeight).padEnd(4)}  title clears ink by ${String(clearance).padStart(4)}px`,
    );
  }
  console.log(`\nWrote ${path.relative(repoRoot, file)}`);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log('\nThe page fits the canvas and its title stays off the drawing.');
}

await main();
