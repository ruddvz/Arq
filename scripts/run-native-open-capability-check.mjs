#!/usr/bin/env node
/**
 * browser_native_open: proves that a user can open a real `.arq` project in the
 * shipped web application, and that what they get is what the product claims.
 *
 * This is the product-integration evidence `e2e_arq_open` deliberately did not
 * provide. That check bundles the Worker and drives it directly, which proves the
 * Worker and OPFS open path; it says so itself and records the remaining gap:
 * "does not prove a user-reachable open-project workflow". This one closes that
 * gap by going through the application - `vite build`, served over plain HTTP,
 * driven through its real controls, with the unmodified golden fixture handed to
 * the real file input.
 *
 * What is asserted, and why each one is here rather than assumed:
 *
 *  - the fixture's SHA-256 is unchanged after every open. The one thing this
 *    build must never do is write to a file a user selected, and the only proof
 *    of that is the bytes.
 *  - the project reaches the workspace: its real name and revision 191, from the
 *    file, in the shell.
 *  - the plan draws the level on show, and switching level changes the drawing.
 *    Compared as pixels, because a plan that renders nothing and a plan that
 *    renders the wrong level look identical in the DOM.
 *  - 3D holds the same canonical wall ids: a wall selected from the model tree
 *    (the project's own id) highlights in 3D. The highlight is phthalo green in
 *    an otherwise monochrome scene, so green-dominant pixels can only be it.
 *  - the shell says where a change would land, and never says it was saved. The
 *    project opens from a local OPFS working copy (ADR-0030), so editing is
 *    allowed and durability is not: the status reports the working copy and
 *    never "Saved locally", because nothing is checkpointed back to the `.arq`
 *    file. The project panel says the same thing in the same words.
 *  - Workers are terminated, and not duplicated. `page.workers()` is counted:
 *    one while a project is open, zero after close, and still one after choosing
 *    the same project twice more. A Worker per open that is never released holds
 *    a whole database resident, and a second Worker over one working copy cannot
 *    open it at all.
 *  - nothing leaves the origin. Every request the page makes is recorded and
 *    checked against the local server, so "the project never leaves the device"
 *    is observed rather than asserted.
 *
 * Usage: node scripts/run-native-open-capability-check.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** See run-model-canvas-capability-check.mjs: sandbox path when present, Playwright's own resolution otherwise. */
function resolveChromiumExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const webDir = path.join(repoRoot, 'apps/web');
const distDir = path.join(webDir, 'dist');
const fixturePath = path.join(repoRoot, 'fixtures/ARQ_Courtyard_House_Golden_Fixture_v2.arq');
const FIXTURE_SHA256 = '0afd9a9785b99ba4338e73067a1af383079363893c30fdc6d538c7e44ed87bd6';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  // The Worker loads sqlite-wasm, which a browser refuses to instantiate from
  // the wrong media type - so a missing entry here would look like a Worker bug.
  '.wasm': 'application/wasm',
};

const STATUS_BAR = '.arq-status-bar';

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function startServer(servedUrls, unservedUrls) {
  return createServer((req, res) => {
    const relative = (req.url === '/' ? '/index.html' : req.url).split('?')[0];
    const filePath = path.join(distDir, relative);
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const contents = readFileSync(filePath);
      servedUrls.push(relative);
      res.writeHead(200, {
        'content-type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream',
      });
      res.end(contents);
    } catch {
      // Worker requests never surface on Playwright's page `response` event, so
      // the server is the only place that sees every request.
      unservedUrls.push(relative);
      res.writeHead(404).end();
    }
  });
}

/**
 * Decodes a PNG screenshot in the page itself (Image -> 2D canvas ->
 * getImageData), so this script needs no PNG library. `inkPixels` is anything
 * clearly darker than the white plan background; `greenDominant` is the 3D
 * selection treatment 0x0b6b50, whose g-r is 96 and g-b is 27 - every other
 * surface in that scene has r === g === b and can never satisfy it.
 */
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
    const colors = new Set();
    let ink = 0;
    let greenDominant = 0;
    let checksum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      colors.add((r << 16) | (g << 8) | b);
      if (r < 200 && g < 200 && b < 200) ink += 1;
      if (g > r + 30 && g > b + 15) greenDominant += 1;
      // Order-sensitive, so two images with the same ink count but different
      // geometry do not compare equal.
      checksum = (checksum * 31 + r + g * 3 + b * 7 + i) % 2_147_483_647;
    }
    return {
      width: scratch.width,
      height: scratch.height,
      uniqueColors: colors.size,
      inkPixels: ink,
      greenDominantPixels: greenDominant,
      checksum,
    };
  }, pngBuffer.toString('base64'));
}

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
  return condition;
}

/**
 * Chooses the fixture when it is already the open project. The dialog closes
 * without reporting anything, because there is nothing to report: this is the
 * project the reader already has.
 */
async function chooseFixtureAgain(page) {
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('dialog').waitFor({ timeout: 10_000 });
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 30_000 });
}

/**
 * Opens the fixture through the real dialog and waits for the real opened state.
 *
 * The wait reports what it actually saw when it gives up. A bare
 * "Timeout 120000ms exceeded" says only that a string never appeared, which is
 * the one thing already known - the dialog's own status line is where the
 * product explains why, and a check that throws it away makes a real product
 * failure look like a flaky test.
 */
async function openFixture(page, label = 'open') {
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('dialog').waitFor({ timeout: 10_000 });
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  try {
    await page.waitForFunction(
      () =>
        document.body.textContent?.includes('Courtyard House Reference is open · revision 191') ===
        true,
      undefined,
      { timeout: 120_000 },
    );
  } catch (error) {
    const status = await page
      .getByRole('dialog')
      .innerText()
      .catch(() => '(the dialog was gone)');
    throw new Error(
      `the ${label} never reached an opened project. The dialog said:\n${status}\n\n${String(error)}`,
    );
  }
  // No confirmation step: adoption closes the dialog itself, so the reader is
  // returned to the workspace with the project in it rather than being asked to
  // acknowledge work that has already finished.
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10_000 });
}

async function run() {
  const beforeHash = sha256(fixturePath);
  if (beforeHash !== FIXTURE_SHA256) {
    throw new Error(
      `the golden fixture is not the recorded one (${beforeHash}); this check must run against the control`,
    );
  }

  execFileSync('npx', ['vite', 'build'], { cwd: webDir, stdio: 'inherit' });
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('vite build did not produce apps/web/dist/index.html');
  }

  const servedUrls = [];
  const unservedUrls = [];
  const server = startServer(servedUrls, unservedUrls);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });
  const observed = {};
  let screenshotPath = null;
  try {
    const page = await browser.newPage({ viewport: { width: 1536, height: 900 } });
    const consoleErrors = [];
    const offOriginRequests = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    // Covers the page and its Workers: a Worker that phoned home would appear
    // here even though its responses do not reach the `response` event.
    page.on('request', (request) => {
      if (!request.url().startsWith(origin) && !request.url().startsWith('data:')) {
        offOriginRequests.push(request.url());
      }
    });

    await page.goto(`${origin}/`);
    await page.waitForSelector('.arq-shell-button', { timeout: 10_000 });
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.includes('Journal current'),
      STATUS_BAR,
      { timeout: 10_000 },
    );
    check(page.workers().length === 0, 'a Worker existed before any project was opened');

    /* ---------------------------------------------------------------- */
    /* Open the golden fixture through the real file input               */
    /* ---------------------------------------------------------------- */
    await openFixture(page);

    observed.workersWhileOpen = page.workers().length;
    check(
      observed.workersWhileOpen === 1,
      `expected one Worker while open, saw ${observed.workersWhileOpen}`,
    );

    const panelText = await page.locator('body').innerText();
    observed.projectHeader = panelText.includes('Courtyard House Reference');
    check(observed.projectHeader, 'the opened project name did not reach the workspace');
    check(
      panelText.includes('revision 191'),
      'the project revision from the file did not reach the workspace',
    );
    // Read from the project, not from this script: the fixture's ground floor
    // carries 37 of its 79 walls. The room count is deliberately not asserted as
    // 34 here - 34 is the project total across three levels, and asserting a
    // project total against one level is how a check comes to pin the wrong fact.
    observed.groundFloorLabel = /Ground floor[\s\S]{0,40}37 walls/.test(panelText);
    check(observed.groundFloorLabel, 'the ground floor did not report its 37 walls');
    // Where a change goes, and what has not happened. Both halves matter: the
    // working copy is real and editable, and nothing in it has reached the file
    // the reader chose.
    observed.workingCopyStated = /Working copy\./.test(panelText);
    check(observed.workingCopyStated, 'the project panel did not say where a change would land');
    check(
      /Nothing is written back to the \.arq file you chose/i.test(panelText),
      'the panel did not say the chosen file is not written back to',
    );
    check(
      !/\bSaved locally\b/.test(panelText),
      'the shell claimed a local save for a project it has not checkpointed',
    );

    /* ---------------------------------------------------------------- */
    /* The plan draws this level, and a level switch changes it          */
    /* ---------------------------------------------------------------- */
    const planCanvas = page.locator('canvas').first();
    const groundFloorImage = await analyzeScreenshot(page, await planCanvas.screenshot());
    observed.groundFloorPlan = groundFloorImage;
    // An empty plan is not near this number, it is at zero: the grid is drawn at
    // rgba(128,128,128,0.16) over white, which composites to about (223,223,223)
    // and so is never counted as ink. Anything in the thousands is drawn geometry.
    check(
      groundFloorImage.inkPixels > 1_000,
      `the ground-floor plan looks empty (${groundFloorImage.inkPixels} ink pixels)`,
    );

    // Scoped to the level control: the model tree also has a row per level, and
    // clicking that would select a level rather than switch to it.
    const levelControl = page.getByRole('group', { name: 'Level' });
    await levelControl.getByRole('button', { name: /Upper floor/ }).click();
    await page.waitForTimeout(300);
    const upperFloorImage = await analyzeScreenshot(page, await planCanvas.screenshot());
    observed.upperFloorPlan = upperFloorImage;
    check(
      upperFloorImage.checksum !== groundFloorImage.checksum,
      'switching level did not change what the plan draws',
    );
    await levelControl.getByRole('button', { name: /Ground floor/ }).click();
    await page.waitForTimeout(300);

    /* ---------------------------------------------------------------- */
    /* 3D holds the same canonical ids                                   */
    /* ---------------------------------------------------------------- */
    // Selected from the model tree by the project's own wall id, so what is
    // being proven is that 3D knows that id - not that two surfaces happen to
    // agree about a wall this script drew.
    const wallRow = page.getByRole('treeitem').filter({ hasText: 'Exterior 250 mm' }).first();
    await wallRow.click();
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.includes('1 selected'),
      STATUS_BAR,
      { timeout: 10_000 },
    );
    await page.getByRole('tab', { name: /3D/ }).click();
    const modelCanvas = page.locator('canvas').first();
    await modelCanvas.waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1_000);
    const threeDeeImage = await analyzeScreenshot(page, await modelCanvas.screenshot());
    observed.threeDee = threeDeeImage;
    check(threeDeeImage.uniqueColors > 1, 'the 3D surface drew nothing');
    check(
      threeDeeImage.greenDominantPixels > 0,
      'the wall selected from the project tree is not highlighted in 3D, so the two surfaces do not share the project ids',
    );

    const workspaceShot = await page.screenshot();
    const outDir = path.join(repoRoot, 'benchmarks/results');
    mkdirSync(outDir, { recursive: true });
    screenshotPath = path.join(outDir, 'native-open-capability.png');
    writeFileSync(screenshotPath, workspaceShot);

    /* ---------------------------------------------------------------- */
    /* Authoring is allowed, and does not claim to have been saved       */
    /* ---------------------------------------------------------------- */
    await page
      .getByRole('tab', { name: /Ground floor|Level 1 Plan|Plan/ })
      .first()
      .click();
    const toolRail = page.getByRole('navigation', { name: 'Tools' });
    await toolRail.getByRole('button', { name: 'Draw', exact: true }).click();
    // Matched by prefix, not exactly: a disabled tool's accessible name is
    // "<label>. <reason>", which is the point - the reason is announced, not only
    // shown in a tooltip. That also means asserting the exact name would silently
    // stop matching the moment the reason appears, so the reason is checked
    // explicitly below instead.
    const wallTool = page
      .getByRole('group', { name: 'Draw tools' })
      .getByRole('button', { name: /^Wall\b/ });
    // Enabled, and that is correct now: the project is open from a writable
    // OPFS working copy, so the tool would have somewhere to put a wall. What
    // must not appear is a claim that the result reached the `.arq` file, and
    // that is asserted on the status text rather than on the tool.
    observed.wallToolDisabled = await wallTool.isDisabled();
    observed.wallToolAccessibleName = await wallTool.getAttribute('aria-label');
    check(
      !observed.wallToolDisabled,
      'the wall tool is refused over a project open from a writable working copy',
    );

    /* ---------------------------------------------------------------- */
    /* Choosing the open project again, close, and reopen                */
    /* ---------------------------------------------------------------- */
    // The working copy is content-addressed, so choosing this file again names
    // the working copy the live session already holds. That must be recognised,
    // not attempted: a second Worker cannot take it, and trying reported "could
    // not be opened" about a project sitting on screen.
    await chooseFixtureAgain(page);
    await chooseFixtureAgain(page);
    observed.workersAfterThreeOpens = page.workers().length;
    check(
      observed.workersAfterThreeOpens === 1,
      `choosing the open project again left ${observed.workersAfterThreeOpens} Workers running; it must reuse the session, not build a second`,
    );
    const afterReChoose = await page.locator('body').innerText();
    check(
      !/could not be opened/i.test(afterReChoose),
      'choosing the already-open project was reported as a failure',
    );

    await page.getByRole('button', { name: 'Close project' }).click();
    await page.waitForFunction(
      () => document.body.textContent?.includes('Close project') === false,
      undefined,
      { timeout: 10_000 },
    );
    await page.waitForTimeout(500);
    observed.workersAfterClose = page.workers().length;
    check(
      observed.workersAfterClose === 0,
      `closing the project left ${observed.workersAfterClose} Workers running`,
    );
    // Back on the workspace's own document, which is editable again. Asserted on
    // the two strings that exist only while a native project is active - the
    // read-only save state and the close control - rather than on the project
    // name, which can legitimately still be in a feedback message that has not
    // expired yet.
    const afterCloseText = await page.locator('body').innerText();
    check(
      !afterCloseText.includes('Working copy.'),
      'the shell still reports an open project after closing it',
    );
    check(
      afterCloseText.includes('Journal current'),
      "the workspace's own journal state did not come back after closing the project",
    );
    const wallToolAfterClose = page
      .getByRole('group', { name: 'Draw tools' })
      .getByRole('button', { name: /^Wall\b/ });
    observed.wallToolEnabledAfterClose = !(await wallToolAfterClose.isDisabled());
    check(
      observed.wallToolEnabledAfterClose,
      "authoring did not come back on the workspace's own document after the project was closed",
    );

    await openFixture(page, 'reopen after close');
    check(page.workers().length === 1, 'reopening after a close did not produce a working project');
    const reopenedText = await page.locator('body').innerText();
    check(
      reopenedText.includes('revision 191'),
      'the reopened project did not report the same revision',
    );

    observed.consoleErrors = consoleErrors;
    observed.offOriginRequests = offOriginRequests;
    check(consoleErrors.length === 0, `console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
    check(
      offOriginRequests.length === 0,
      `the page made requests off this origin: ${offOriginRequests.slice(0, 3).join(' | ')}`,
    );
    check(
      unservedUrls.length === 0,
      `unserved resources: ${[...new Set(unservedUrls)].join(' | ')}`,
    );
  } finally {
    await browser.close();
    server.close();
  }

  const afterHash = sha256(fixturePath);
  check(
    afterHash === FIXTURE_SHA256,
    `the golden fixture changed during the run (${afterHash}); the selected file must never be written`,
  );

  const version = await (async () => {
    const b = await chromium.launch({ executablePath: resolveChromiumExecutablePath() });
    const v = b.version();
    await b.close();
    return v;
  })();

  const artifact = {
    evidenceId: 'browser_native_open',
    timestamp: new Date().toISOString(),
    environment: `headless Chromium ${version} - the vite-built apps/web bundle served over plain HTTP, driven through its real controls`,
    fixture: {
      path: path.relative(repoRoot, fixturePath),
      sha256Before: beforeHash,
      sha256After: afterHash,
      unchanged: beforeHash === afterHash,
    },
    observed,
    failures,
    ok: failures.length === 0,
    limitation:
      'Chromium only. Proves a user-reachable open of the reference project fixture, level switching, shared plan/3D ids, the working-copy statement, Worker teardown and same-origin behaviour. Proves nothing about checkpointing edits back to the .arq file, migration or any other browser engine.',
    ...(screenshotPath === null ? {} : { screenshot: path.relative(repoRoot, screenshotPath) }),
  };

  const outDir = path.join(repoRoot, 'benchmarks/results');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `native-open-capability-${artifact.timestamp.replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  console.log(JSON.stringify(artifact, null, 2));
  console.log(`Saved to ${path.relative(repoRoot, outPath)}`);
  if (!artifact.ok) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
