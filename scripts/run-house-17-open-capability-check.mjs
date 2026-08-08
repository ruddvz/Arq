#!/usr/bin/env node
/**
 * browser_house_17_open: proves that ARQ House 17.0 opens in the shipped web
 * application and reaches the workspace as the project it actually is.
 *
 * `run-native-open-capability-check.mjs` is the control: it drives the same
 * application with the golden fixture, a file authored against the reader's own
 * contract. This one drives it with `house.arq`, a real project authored
 * elsewhere in a different vocabulary, and it exists because that file used to
 * open *wrongly* rather than not at all.
 *
 * The regression it guards is worth stating precisely, because it is the kind a
 * passing test suite will not notice. `decodeNativeProjectModel` dispatches on a
 * root `projectName`, and 17.0 carries one, so the app took the flat path - the
 * shape this build writes for its own files - and adopted the project as 68 bare
 * wall centrelines with `document: null`. Every level, wall type, opening, door,
 * window and room was discarded at the moment of opening, and nothing said so. A
 * user would have been shown a stick drawing of a coordinated house and had no
 * way to tell the difference between "not drawn yet" and "thrown away".
 *
 * So the assertions here are about what reached the workspace, not about whether
 * an open succeeded:
 *
 *  - `house.arq`'s SHA-256 is unchanged after opening. A file a user selected
 *    must never be written to, and the bytes are the only proof.
 *  - the project's own identity reaches the shell: its name and revision 670,
 *    read from the file rather than asserted by this script.
 *  - the plan actually draws. Measured as ink pixels on the canvas, because a
 *    plan that renders nothing looks identical in the DOM to one that renders.
 *  - the drawing carries more than centrelines. The degraded read produced only
 *    68 thin lines; the full read adds wall thickness, rooms and openings, so
 *    the ink count is compared against a floor that bare centrelines cannot
 *    reach.
 *  - switching level changes the drawing. Three levels hydrated is the claim;
 *    a plan that looks the same on every level has not hydrated them.
 *
 * Screenshots are written to the output directory so the result can be looked
 * at, not just asserted - the whole history of this fixture is a record of
 * automated checks passing while a person could see the drawing was wrong.
 *
 * Usage:
 *   node scripts/run-house-17-open-capability-check.mjs <path-to/house.arq> [--out <dir>]
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
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

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

/**
 * The ink floor a full read has to clear.
 *
 * The degraded read drew 68 hairline centrelines and nothing else. Wall
 * thickness, room fills and opening symbols are each larger than that put
 * together, so a full read clears this comfortably while the regression cannot
 * approach it. Deliberately not tuned to the current exact number: this is a
 * floor that separates two behaviours, not a golden value that breaks whenever
 * a line weight changes.
 */
const MINIMUM_INK_PIXELS = 20_000;

function parseArguments(argv) {
  const positional = [];
  let out = path.join(repoRoot, 'validation/arq-house-17/screenshots');
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out') {
      out = argv[index + 1] ?? out;
      index += 1;
    } else {
      positional.push(argv[index]);
    }
  }
  return { arqPath: positional[0] ?? null, out };
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function startServer(unservedUrls) {
  return createServer((req, res) => {
    const relative = (req.url === '/' ? '/index.html' : req.url).split('?')[0];
    const filePath = path.join(distDir, relative);
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const contents = readFileSync(filePath);
      res.writeHead(200, {
        'content-type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      });
      res.end(contents);
    } catch {
      unservedUrls.push(relative);
      res.writeHead(404).end();
    }
  });
}

/** Decodes a screenshot in the page itself, so this script needs no PNG library. */
function analyzeScreenshot(page, pngBuffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const scratch = document.createElement('canvas');
    scratch.width = image.naturalWidth;
    scratch.height = image.naturalHeight;
    const ctx = scratch.getContext('2d');
    if (ctx === null) throw new Error('screenshot-decode canvas refused a 2d context');
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, scratch.width, scratch.height).data;
    let ink = 0;
    let checksum = 0;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      colors.add((r << 16) | (g << 8) | b);
      if (r < 200 && g < 200 && b < 200) ink += 1;
      checksum = (checksum * 31 + r + g * 3 + b * 7 + i) % 2_147_483_647;
    }
    return {
      width: scratch.width,
      height: scratch.height,
      inkPixels: ink,
      uniqueColors: colors.size,
      checksum,
    };
  }, pngBuffer.toString('base64'));
}

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
  return condition;
}

async function main() {
  const { arqPath, out } = parseArguments(process.argv.slice(2));
  if (arqPath === null || !existsSync(arqPath)) {
    console.error(
      'usage: node scripts/run-house-17-open-capability-check.mjs <path-to/house.arq> [--out <dir>]',
    );
    process.exit(2);
  }
  mkdirSync(out, { recursive: true });

  const beforeHash = sha256(arqPath);
  console.log(`File: ${arqPath}`);
  console.log(`SHA-256 before: ${beforeHash}`);

  if (!existsSync(path.join(distDir, 'index.html'))) {
    console.log('Building apps/web …');
    execFileSync('npx', ['vite', 'build'], { cwd: webDir, stdio: 'inherit' });
  }

  const unservedUrls = [];
  const server = startServer(unservedUrls);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ executablePath: resolveChromiumExecutablePath() });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  try {
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.arq-shell-button', { timeout: 20_000 });

    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await page.getByRole('dialog').waitFor({ timeout: 10_000 });
    await page.locator('input[type="file"]').setInputFiles(arqPath);

    let opened = true;
    try {
      // Waits on the workspace rather than the dialog: adoption closes the
      // dialog, so its status line is destroyed at the moment it becomes true.
      await page.waitForFunction(
        () => {
          const text = document.body.textContent ?? '';
          return text.includes('House') && /revision\s*670/i.test(text);
        },
        undefined,
        { timeout: 180_000 },
      );
    } catch (error) {
      opened = false;
      const dialog = await page
        .getByRole('dialog')
        .innerText()
        .catch(() => null);
      const workspace = await page
        .locator('body')
        .innerText()
        .catch(() => '(unreadable)');
      failures.push(
        `house.arq never reached an opened project. ` +
          (dialog === null
            ? `The dialog had already closed, so the open was not refused - the workspace never showed the project. It showed:\n${workspace.slice(0, 1200)}`
            : `The dialog said:\n${dialog.slice(0, 1200)}`) +
          `\n${String(error).slice(0, 300)}`,
      );
    }

    if (opened) {
      const panelText = await page.locator('body').innerText();
      check(
        /revision\s*670/i.test(panelText),
        'the shell never reported revision 670 from the file',
      );

      await page.waitForTimeout(1500);
      const first = await page.screenshot();
      writeFileSync(path.join(out, 'house-17-ground.png'), first);
      const firstStats = await analyzeScreenshot(page, first);
      console.log(`Ground: ink ${firstStats.inkPixels}, unique colours ${firstStats.uniqueColors}`);
      check(
        firstStats.inkPixels > MINIMUM_INK_PIXELS,
        `the plan drew only ${firstStats.inkPixels} ink pixels, below the ${MINIMUM_INK_PIXELS} a full read clears - this is what the centrelines-only regression looked like`,
      );

      // Switching level. Three levels hydrated is the claim; a plan that looks
      // identical on another level has not hydrated them.
      const levelButtons = page.locator('button', { hasText: /upper|first|level/i });
      const levelCount = await levelButtons.count();
      let second = null;
      for (let index = 0; index < levelCount; index += 1) {
        const label = (
          await levelButtons
            .nth(index)
            .innerText()
            .catch(() => '')
        ).trim();
        if (/upper/i.test(label)) {
          await levelButtons.nth(index).click();
          await page.waitForTimeout(1500);
          second = await page.screenshot();
          break;
        }
      }
      if (second !== null) {
        writeFileSync(path.join(out, 'house-17-upper.png'), second);
        const secondStats = await analyzeScreenshot(page, second);
        console.log(
          `Upper:  ink ${secondStats.inkPixels}, unique colours ${secondStats.uniqueColors}`,
        );
        check(
          secondStats.checksum !== firstStats.checksum,
          'switching level did not change the drawing, so the levels are not separately hydrated',
        );
      } else {
        console.log('Upper:  no level control matched - level switching not asserted.');
      }
    }

    const afterHash = sha256(arqPath);
    check(
      afterHash === beforeHash,
      `house.arq changed on disk during the open (${beforeHash} -> ${afterHash}); a chosen file must never be written to`,
    );
    console.log(`SHA-256 after:  ${afterHash}`);
    check(
      unservedUrls.length === 0,
      `the page requested files the build did not produce: ${unservedUrls.join(', ')}`,
    );
  } finally {
    await context.close();
    await browser.close();
    server.close();
  }

  if (consoleErrors.length > 0) {
    console.log(`Console errors (${consoleErrors.length}):`);
    for (const message of consoleErrors.slice(0, 5)) console.log(`  ${message.slice(0, 200)}`);
  }
  console.log(`Screenshots: ${out}`);

  if (failures.length > 0) {
    console.error(`\nFAILED (${failures.length}):`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log('\nPASSED: ARQ House 17.0 opens in the product and reaches the workspace.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
