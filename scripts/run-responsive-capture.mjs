#!/usr/bin/env node
/**
 * Captures the running product with the golden fixture open, at the four
 * viewport classes Version 13 requires: 1600x1000, 1366x1024, 1024x768 and
 * 430x932.
 *
 * This exists because of a specific way the evidence went wrong. A previous
 * round presented a wide desktop capture, scaled down and opened in a phone
 * image viewer, as phone evidence. It is not: a phone screenshot has to come
 * from a browser laid out at phone width, resolving the phone composition, with
 * the phone's own controls. So every capture here sets a real viewport and a
 * real pointer type before the page loads, and each one records the band the
 * product itself resolved rather than the band this script expected.
 *
 * It also asserts, in-page and per viewport, the three things the Version 13
 * package explicitly rejects: no "demo fixture" string, no "Fixture wall"
 * string, and no horizontal overflow. A capture that shows placeholder content
 * is worse than no capture, because it looks like progress.
 *
 * Every viewport opens the fixture through the real dialog. Nothing is faked,
 * nothing is scaled, and no image is reused between sizes.
 *
 * Usage: node scripts/run-responsive-capture.mjs
 */

import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const webDir = path.join(repoRoot, 'apps/web');
const distDir = path.join(webDir, 'dist');
const outDir = path.join(repoRoot, 'benchmarks/results/responsive');
const fixturePath = path.join(repoRoot, 'fixtures/ARQ_Courtyard_House_Golden_Fixture_v2.arq');
const FIXTURE_SHA256 = '0afd9a9785b99ba4338e73067a1af383079363893c30fdc6d538c7e44ed87bd6';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

/**
 * The four classes, with the pointer each one really has. A tablet and a phone
 * report a coarse pointer, and `resolveWorkspacePlatform` reads it - so
 * capturing them with a mouse pointer would resolve a band no such device ever
 * resolves, which is the scaled-desktop failure in a subtler form.
 */
const VIEWPORTS = [
  { name: 'desktop-1600x1000', width: 1600, height: 1000, touch: false },
  { name: 'ipad-regular-1366x1024', width: 1366, height: 1024, touch: true },
  { name: 'ipad-compact-1024x768', width: 1024, height: 768, touch: true },
  { name: 'phone-430x932', width: 430, height: 932, touch: true },
];

function resolveChromiumExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined;
}

function startServer() {
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
      res.writeHead(404).end();
    }
  });
}

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
  return condition;
}

/**
 * Opens the fixture. The control is named differently per band - the desktop
 * bar says "Open" and the phone reaches projects through "Back to projects" -
 * so this asks for either rather than assuming the desktop label. A previous
 * run looked only for "Open", found nothing on the phone, and published "the
 * phone cannot open a project at all", which was false and was a defect in the
 * harness rather than in the product.
 */
async function openFixture(page) {
  const desktopOpen = page.getByRole('button', { name: 'Open', exact: true });
  const phoneOpen = page.getByRole('button', { name: /Back to projects/i });
  if ((await desktopOpen.count()) > 0) {
    await desktopOpen.first().click();
  } else if ((await phoneOpen.count()) > 0) {
    await phoneOpen.first().click();
  } else {
    return { opened: false, reason: 'no control on this band offers to open a project' };
  }

  const dialog = page.getByRole('dialog');
  await dialog.waitFor({ timeout: 15_000 });
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  try {
    /*
     * Waits on the project's name only.
     *
     * A first version also required "revision 191", which the desktop project
     * panel renders and the touch bands do not - their Navigator lives in a
     * sheet that is closed on arrival. That made both iPad-compact and phone
     * report "the fixture did not open" while the same run recorded the project
     * name on screen: a harness assumption about one band's chrome, published
     * as a product failure on another. The same mistake as looking for a
     * control named "Open" on a phone.
     */
    await page.waitForFunction(
      () => (document.body.textContent ?? '').includes('Courtyard House Reference'),
      undefined,
      { timeout: 120_000 },
    );
    return { opened: true, reason: null };
  } catch {
    // The dialog's own status line is where the product explains itself. A bare
    // timeout says only that a string never appeared, which is already known.
    const status = await dialog
      .textContent()
      .catch(() => null)
      .then((text) => (text ?? '').slice(0, 400));
    return { opened: false, reason: `did not reach the opened state. Dialog said: ${status}` };
  }
}

async function main() {
  check(
    createHash('sha256').update(readFileSync(fixturePath)).digest('hex') === FIXTURE_SHA256,
    'the golden fixture is not the file this capture claims to open',
  );

  execFileSync('pnpm', ['--filter', '@arq/web', 'build'], { cwd: repoRoot, stdio: 'inherit' });
  mkdirSync(outDir, { recursive: true });

  const server = startServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const browser = await chromium.launch({ executablePath: resolveChromiumExecutablePath() });
  const captures = [];

  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        hasTouch: viewport.touch,
        isMobile: false,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const consoleErrors = [];
      page.on('pageerror', (error) => consoleErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });

      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
      const opened = await openFixture(page);
      await page.waitForTimeout(1200);

      const observed = await page.evaluate(() => {
        const root = document.querySelector('.arq-workspace');
        const canvas = document.querySelector('canvas');
        const rect = canvas?.getBoundingClientRect();
        const text = document.body.textContent ?? '';
        return {
          band: root?.getAttribute('data-workspace-platform') ?? null,
          canvas:
            rect === undefined
              ? null
              : { width: Math.round(rect.width), height: Math.round(rect.height) },
          horizontalOverflow:
            document.documentElement.scrollWidth > document.documentElement.clientWidth,
          hasDemoFixtureString: text.includes('demo fixture'),
          hasFixtureWallString: text.includes('Fixture wall'),
          showsProjectName: text.includes('Courtyard House Reference'),
        };
      });

      const file = path.join(outDir, `${viewport.name}.png`);
      writeFileSync(file, await page.screenshot({ fullPage: false }));

      check(opened.opened, `${viewport.name}: the fixture did not open - ${opened.reason ?? ''}`);
      check(
        !observed.horizontalOverflow,
        `${viewport.name}: the page scrolls horizontally, so the composition does not fit its own viewport`,
      );
      check(
        !observed.hasDemoFixtureString,
        `${viewport.name}: the running product still says "demo fixture"`,
      );
      check(
        !observed.hasFixtureWallString,
        `${viewport.name}: the running product still says "Fixture wall"`,
      );
      check(
        consoleErrors.length === 0,
        `${viewport.name}: the page reported errors - ${consoleErrors.slice(0, 2).join(' | ')}`,
      );

      captures.push({
        ...viewport,
        ...observed,
        opened: opened.opened,
        openFailure: opened.reason,
        consoleErrors,
        screenshot: path.relative(repoRoot, file),
      });
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }

  const report = {
    generatedFrom: 'apps/web dist, built by this script',
    fixture: path.relative(repoRoot, fixturePath),
    fixtureSha256: FIXTURE_SHA256,
    captures,
    failures,
    ok: failures.length === 0,
    limitation:
      'Chromium only. Each capture is a real browser laid out at that viewport with the fixture opened through the real dialog - no image is scaled, reused between sizes, or viewed in a device frame. It proves composition and content at these four sizes; it proves nothing about other engines, or about how the composition compares to the Version 13 reference, which no baseline yet checks.',
  };
  const reportPath = path.join(outDir, 'responsive-capture.json');
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

await main();
