#!/usr/bin/env node
/**
 * browser_network_observation: proves the built Arq web application contacts
 * no origin other than the one it was served from, while a person actually
 * uses it.
 *
 * This exists to settle a named conflict rather than to add a nice-to-have.
 * `docs/product/voice/conflict-registry.json` records
 * DRIFT-PRIVACY-TRANSPORT-ABSOLUTE at high severity, state
 * `evidence-insufficient`: "Security copy says the development build sends
 * nothing anywhere, an absolute transport claim not bound to an approved
 * network-observation evidence source." Its resolution requires exactly one
 * of two things - "Network-observation test and approved privacy statement,
 * or revised copy" - and until one arrives the claim `no-network-data-transfer`
 * ("sends nothing anywhere", "nothing leaves your device") is blocked on the
 * public and support surfaces. This is the first of those two options.
 *
 * What makes the observation trustworthy:
 *
 * - It watches the browser, not the source. Grepping for `fetch(` proves
 *   nothing about a dependency, an image tag, a font, a prefetch, a beacon,
 *   or a WebSocket. Chromium reports every request it actually attempts,
 *   whoever asked for it.
 * - Requests are RECORDED, never blocked. Blocking outbound traffic and then
 *   observing none would be measuring the harness. Everything is allowed to
 *   proceed and the destinations are read afterwards.
 * - `page.on('request')` fires for requests that never complete, so a request
 *   to an unreachable host still counts as an attempt. Intent to transmit is
 *   the thing being claimed about, not success.
 * - It exercises the app rather than only loading it: draws a wall through
 *   the real tool rail and canvas (so the journal writes, the validators run
 *   and the renderer draws), opens the file panel, and switches to the 3D
 *   tab, because a privacy claim about an idle blank page is worth little.
 * - It also fails if NOTHING was observed at all, which would mean the
 *   harness never attached and a clean result is meaningless.
 *
 * What it does not claim: that no future build can transmit, that the
 * marketing site makes no requests, or anything about a server Arq does not
 * have yet. It observes this bundle, in this browser, over this session.
 *
 * Usage: node scripts/run-network-observation-capability-check.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
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

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
};

function buildBundle() {
  execFileSync('npx', ['vite', 'build'], { cwd: webDir, stdio: 'inherit' });
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('vite build did not produce apps/web/dist/index.html');
  }
}

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

/**
 * A request is "off-device" unless it goes to the origin serving the app or
 * is a scheme that never leaves the browser.
 *
 * `data:` and `blob:` are in-memory. `about:` is the browser's own. Anything
 * else - including a bare IP, a CDN, a font host or a telemetry endpoint - is
 * a finding, which is the point: the claim is absolute, so the test must be
 * too, rather than carrying an allowlist that quietly grows.
 */
function classifyRequest(url, appOrigin) {
  if (/^(data|blob|about):/u.test(url)) return 'in-memory';
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return 'unparseable';
  }
  return parsed.origin === appOrigin ? 'same-origin' : 'off-device';
}

/** Activates the Wall tool through its real rail controls, as a person would. */
async function activateWallTool(page) {
  const drawCategory = page.locator('button', { hasText: 'Draw' }).first();
  if (await drawCategory.count()) {
    await drawCategory.click().catch(() => {});
  }
  const wallTool = page.locator('[data-tool-id="wall"], button', { hasText: 'Wall' }).first();
  if (await wallTool.count()) {
    await wallTool.click().catch(() => {});
    return true;
  }
  return false;
}

async function exerciseApplication(page) {
  const performed = [];

  // Draw a wall: journal write, validation, plan render.
  if (await activateWallTool(page)) {
    performed.push('activated the wall tool');
    const canvas = page.locator('.arq-workspace__viewport canvas, canvas').first();
    if (await canvas.count()) {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4);
        await page.mouse.up();
        await page.keyboard.press('Enter');
        performed.push('drew a wall on the plan canvas');
      }
    }
  }

  // The 3D tab: WebGL2, the model renderer, its own asset loading.
  const threeDeeTab = page.locator('[role="tab"]', { hasText: '3D' }).first();
  if (await threeDeeTab.count()) {
    await threeDeeTab.click().catch(() => {});
    performed.push('switched to the 3D view');
  }

  // The file-open surface: the one place a user hands the app bytes.
  const openControl = page.locator('button', { hasText: /Open|File/u }).first();
  if (await openControl.count()) {
    await openControl.click().catch(() => {});
    performed.push('opened the file panel');
  }

  await page.waitForTimeout(1500);
  return performed;
}

async function run() {
  buildBundle();
  const server = startServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const appOrigin = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ executablePath: resolveChromiumExecutablePath() });
  const context = await browser.newContext();
  const page = await context.newPage();

  const requests = [];
  const consoleErrors = [];
  // Every request the browser ATTEMPTS, including ones that never resolve.
  page.on('request', (request) => {
    requests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
    });
  });
  // WebSocket handshakes appear as requests, but the dedicated event is
  // recorded too so a socket to another origin cannot slip past.
  const webSockets = [];
  page.on('websocket', (socket) => webSockets.push(socket.url()));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  let performed = [];
  try {
    await page.goto(appOrigin, { waitUntil: 'networkidle' });
    performed = await exerciseApplication(page);
    await page.reload({ waitUntil: 'networkidle' });
  } finally {
    await browser.close();
    server.close();
  }

  const classified = requests.map((request) => ({
    ...request,
    disposition: classifyRequest(request.url, appOrigin),
  }));
  const offDevice = classified.filter((request) => request.disposition === 'off-device');
  const offDeviceSockets = webSockets.filter(
    (url) => classifyRequest(url.replace(/^ws/u, 'http'), appOrigin) === 'off-device',
  );

  // A result of "nothing observed" would mean the listener never attached,
  // which must not read as a clean bill of health.
  const observedAnything = classified.length > 0;

  const ok =
    observedAnything &&
    offDevice.length === 0 &&
    offDeviceSockets.length === 0 &&
    consoleErrors.length === 0;

  return {
    timestamp: new Date().toISOString(),
    environment: `headless Chromium ${browser.version?.() ?? ''}`.trim(),
    evidenceId: 'browser_network_observation',
    ok,
    claim: 'no-network-data-transfer',
    conflict: 'DRIFT-PRIVACY-TRANSPORT-ABSOLUTE',
    appOrigin,
    interactionsPerformed: performed,
    requestsObserved: classified.length,
    byDisposition: classified.reduce((counts, request) => {
      counts[request.disposition] = (counts[request.disposition] ?? 0) + 1;
      return counts;
    }, {}),
    offDeviceRequests: offDevice,
    webSocketsOpened: webSockets,
    offDeviceWebSockets: offDeviceSockets,
    consoleErrors,
  };
}

const result = await run();
mkdirSync(resultsDir, { recursive: true });
const outputPath = path.join(
  resultsDir,
  `network-observation-capability-${result.timestamp.replace(/[:.]/gu, '-')}.json`,
);
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`\nSaved to ${path.relative(repoRoot, outputPath)}\n`);
if (!result.ok) {
  process.stderr.write('\nNetwork observation FAILED: the application contacted another origin.\n');
  process.exitCode = 1;
}
