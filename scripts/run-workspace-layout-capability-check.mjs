#!/usr/bin/env node
/**
 * Doc 52 ("Workspace Visual QA Protocol") and `workspace-qa-fixtures.json`.
 *
 * Drives the real production apps/web bundle in headless Chromium at every
 * viewport the QA fixtures declare, and asserts the layout rules the workspace
 * actually promises - rather than screenshotting and asking a human to notice.
 *
 * These are the checks that found the three defects the workspace shell shipped
 * with and could not have caught any other way: the app never imported
 * shell-controls.css so the shell rendered unstyled; the canvas floor was
 * computed from the registry's 48px tool rail while the rendered rail is 200px,
 * leaving it ~150px optimistic; and the tablet bands rendered two docked columns
 * that reduced an 834px iPad to a zero-width canvas. Every one of those passed
 * typecheck and 1,600 unit tests.
 *
 * What is asserted per viewport:
 *
 * - the expected platform band, so a responsive rule cannot silently regress;
 * - the canvas clears the layout's registry `canvasMinWidth` where one exists;
 * - no horizontal document overflow (fixture check "no clipped primary action");
 * - touch bands render no docked columns and no rails (doc 46's "never shrink
 *   desktop three-column UI"), and offer a control to summon the panels back;
 * - desktop bands render the tab strip and at least one docked panel;
 * - the active view is identifiable without opening a menu (fixture check
 *   "tab active state visible");
 * - save and sync are separately legible (fixture check);
 * - no console errors.
 *
 * Usage: node scripts/run-workspace-layout-capability-check.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * `/opt/pw-browsers/chromium` is the development sandbox's pre-installed
 * browser. A plain CI runner installs to Playwright's own cache instead, so
 * falling back to `undefined` (Playwright's resolution) covers both without
 * special-casing CI - the same fallback run-file-open-capability-check.mjs
 * needed after it failed on its first real CI run.
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
const resultsDir = path.join(repoRoot, 'benchmarks/results');

const layoutSlots = JSON.parse(
  readFileSync(
    path.join(repoRoot, 'packages/workspace/src/registry/workspace-layout-slots.json'),
    'utf8',
  ),
).layouts;

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

/**
 * The eight viewports `workspace-qa-fixtures.json` lists, each mapped to the
 * band it must resolve to and the registry layout whose floor applies. The
 * mapping is asserted, not assumed - that is the point of naming it here.
 */
const VIEWPORTS = [
  {
    id: 'layout-1920x1080',
    width: 1920,
    height: 1080,
    touch: false,
    band: 'desktop',
    layout: 'wide1920',
  },
  {
    id: 'layout-1536x864',
    width: 1536,
    height: 864,
    touch: false,
    band: 'desktop',
    layout: 'desktop1536',
  },
  {
    id: 'layout-1366x768',
    width: 1366,
    height: 768,
    touch: false,
    band: 'desktop',
    layout: 'desktop1536',
  },
  {
    id: 'layout-1024x768',
    width: 1024,
    height: 768,
    touch: false,
    band: 'compact-desktop',
    layout: 'desktop1024',
  },
  {
    id: 'layout-1194x834',
    width: 1194,
    height: 834,
    touch: true,
    band: 'tablet-landscape',
    layout: 'ipadLandscape1194x834',
  },
  {
    id: 'layout-834x1194',
    width: 834,
    height: 1194,
    touch: true,
    band: 'tablet-portrait',
    layout: 'ipadPortrait834x1194',
  },
  {
    id: 'layout-393x852',
    width: 393,
    height: 852,
    touch: true,
    band: 'phone',
    layout: 'iphone393x852',
  },
  {
    id: 'layout-412x915',
    width: 412,
    height: 915,
    touch: true,
    band: 'phone',
    layout: 'android412x915',
  },
];

/**
 * Always rebuilds, then asserts the output exists - the shape every other
 * capability check in this directory already uses.
 *
 * This function previously skipped the build whenever apps/web/dist/index.html
 * was present, which made the check report on whatever bundle happened to be
 * on disk rather than on the working tree. On a fresh CI checkout there is no
 * dist and the two behave identically, so the difference only ever showed up
 * locally - where it matters most, because that is where someone re-runs the
 * check to confirm a fix. It caught exactly that: a live-region fix in
 * status-bar.tsx was reported as still broken because the stale bundle
 * predated it. A check that can pass or fail on code that is not the code
 * under review is not evidence. The rebuild costs about nine seconds.
 */
function buildBundle() {
  execFileSync('npx', ['vite', 'build'], { cwd: webDir, stdio: 'inherit' });
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('vite build did not produce apps/web/dist/index.html');
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.arq-workspace');
    const canvas = document.querySelector('.arq-workspace__viewport');
    const text = document.body.innerText;
    return {
      band: root?.className.replace('arq-workspace arq-workspace--', '') ?? null,
      canvasWidth: canvas ? Math.round(canvas.getBoundingClientRect().width) : 0,
      canvasHeight: canvas ? Math.round(canvas.getBoundingClientRect().height) : 0,
      dockedPanels: document.querySelectorAll('.arq-workspace__docked').length,
      rails: document.querySelectorAll('.arq-mode-rail, .arq-tool-rail').length,
      tabStrips: document.querySelectorAll('.arq-tab-strip').length,
      compactViewControls: document.querySelectorAll('.arq-compact-view-control').length,
      panelSummonControls: document.querySelectorAll(
        '.arq-phone-dock__button[aria-haspopup="dialog"], .arq-tablet-drawer-bar button',
      ).length,
      activeTabVisible:
        document.querySelector('.arq-tab-strip [role="tab"][aria-selected="true"]') !== null ||
        document.querySelector('.arq-compact-view-control button') !== null,
      // The fixture check is "save and sync separately visible **or available
      // in the project menu**" - both must be nameable, never merged into one
      // word, but doc 36 explicitly allows the low-priority status text to
      // collapse into the overflow menu at compact widths. So a collapsed slot
      // counts as satisfied; a missing one does not.
      collapsedSlots: document.querySelector('.arq-top-bar')?.dataset.collapsedSlots ?? '',
      saveAndSyncLegible:
        /No project open|Saved|Saving|Unsaved|Recovered/.test(text) &&
        // Every label the governed `sync` machine defines, including
        // "Sync not configured" - the honest state for a build with no sync
        // backend, which 'offline' overclaimed as merely unreachable.
        /Sync not configured|Synced|Syncing|Offline|Sync error|Sync failed|Sync conflict|Changes queued/.test(
          text,
        ),
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      /*
       * Live-region scope. The status bar carried `role="status"
       * aria-live="polite"` on its own <footer>, so every child announced
       * itself on change - including the cursor world position, which changes
       * on every pointer move. A polite region queues rather than interrupts,
       * so a screen reader falls arbitrarily far behind reading coordinates
       * and never reaches anything else. Measured in the real DOM because
       * "which element is a live region" is a rendering fact, and this
       * repository has no component-test stack that could assert it.
       */
      statusBarIsLiveRegion: (() => {
        const bar = document.querySelector('.arq-status-bar');
        if (bar === null) return false;
        const live = bar.getAttribute('aria-live');
        return live !== null && live !== 'off';
      })(),
      /* Every element that would announce itself, and whether any of them
       * contains a coordinate readout. Ancestors count: a live region
       * announces its whole subtree. */
      liveRegionsAnnouncingCoordinates: Array.from(
        document.querySelectorAll('[aria-live="polite"], [aria-live="assertive"]'),
      ).filter((node) => /-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/u.test(node.textContent ?? '')).length,
    };
  });
}

function checkViewport(viewport, m, consoleErrors) {
  const failures = [];
  const slots = layoutSlots[viewport.layout];
  const touch = viewport.band === 'phone' || viewport.band.startsWith('tablet');

  if (m.band !== viewport.band) {
    failures.push(`resolved band "${m.band}", expected "${viewport.band}"`);
  }
  if (m.horizontalOverflow) {
    failures.push('document overflows horizontally');
  }
  if (m.canvasWidth <= 0 || m.canvasHeight <= 0) {
    failures.push(`canvas collapsed to ${m.canvasWidth}x${m.canvasHeight}`);
  }
  // Only the layouts that dock two columns declare a floor; the touch layouts
  // have no docked columns for a floor to protect.
  if (typeof slots?.canvasMinWidth === 'number' && m.canvasWidth < slots.canvasMinWidth) {
    failures.push(`canvas ${m.canvasWidth}px is under the ${slots.canvasMinWidth}px floor`);
  }
  if (touch) {
    // Doc 46: "Never shrink desktop three-column UI onto a phone."
    if (m.dockedPanels > 0) {
      failures.push(`${m.dockedPanels} docked panel(s) on a touch band`);
    }
    if (m.rails > 0) {
      failures.push(`${m.rails} rail(s) on a touch band`);
    }
    // A panel that cannot be summoned back does not exist.
    if (m.panelSummonControls === 0) {
      failures.push('no control to summon the browser or inspector');
    }
  } else {
    if (m.dockedPanels === 0) {
      failures.push('no docked panel on a docking band');
    }
    if (m.tabStrips === 0) {
      failures.push('no view tab strip on a docking band');
    }
  }
  if (viewport.band === 'phone' && m.compactViewControls === 0) {
    failures.push('phone has no compact current-view control');
  }
  if (!m.activeTabVisible) {
    failures.push('active view is not identifiable without opening a menu');
  }
  const collapsed = new Set(m.collapsedSlots.split(',').filter(Boolean));
  const saveReachable = m.saveAndSyncLegible || collapsed.has('save-state');
  const syncReachable = m.saveAndSyncLegible || collapsed.has('sync-state');
  if (!saveReachable || !syncReachable) {
    failures.push('save and sync are neither visible nor in the project menu');
  }
  // Section 127 asks that the canvas readout be available, not that it be
  // spoken continuously. A live region wrapping a value that changes with the
  // pointer is not an accessibility feature; it is a screen reader that cannot
  // be interrupted.
  if (m.statusBarIsLiveRegion) {
    failures.push('the status bar is a live region, so it announces cursor coordinates on move');
  }
  if (m.liveRegionsAnnouncingCoordinates > 0) {
    failures.push(
      `${m.liveRegionsAnnouncingCoordinates} live region(s) contain a coordinate readout`,
    );
  }
  // Doc 36's protected pair may never collapse, at any width.
  for (const protectedSlot of ['project-identity', 'active-view']) {
    if (collapsed.has(protectedSlot)) {
      failures.push(`${protectedSlot} collapsed, but doc 36 says it never disappears`);
    }
  }
  if (consoleErrors.length > 0) {
    failures.push(`console errors: ${consoleErrors.join(' | ')}`);
  }
  return failures;
}

async function main() {
  buildBundle();
  const server = startServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const browser = await chromium.launch({ executablePath: resolveChromiumExecutablePath() });

  const results = [];
  let failed = 0;

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.touch,
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(String(error)));

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
    // The viewport probe measures on an effect, so give React one paint.
    await page.waitForTimeout(400);

    const measurement = await measure(page);
    const failures = checkViewport(viewport, measurement, consoleErrors);
    if (failures.length > 0) failed += 1;

    results.push({ ...viewport, measurement, failures });
    console.log(
      `${failures.length === 0 ? 'PASS' : 'FAIL'}  ${viewport.id.padEnd(16)} ${measurement.band?.padEnd(17) ?? '?'} canvas ${String(measurement.canvasWidth).padStart(5)}px  docked ${measurement.dockedPanels}  rails ${measurement.rails}`,
    );
    for (const failure of failures) console.log(`        - ${failure}`);

    await context.close();
  }

  await browser.close();
  server.close();

  mkdirSync(resultsDir, { recursive: true });
  const outPath = path.join(
    resultsDir,
    `workspace-layout-capability-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(
    outPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), viewports: results }, null, 2)}\n`,
  );
  console.log(`\nWrote ${path.relative(repoRoot, outPath)}`);

  if (failed > 0) {
    console.error(`\n${failed} of ${VIEWPORTS.length} viewports failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${VIEWPORTS.length} viewports pass.`);
}

await main();
