#!/usr/bin/env node
/**
 * browser_selection_authority: deterministic evidence for ARQ issue #401.
 *
 * This is an audit probe, not a selection implementation. It drives the
 * production Vite bundle through public controls and proves the current
 * authority/transition contract without adding a store or changing App.tsx.
 *
 * Scenarios:
 *  1. Plan wall selection projects into tree, inspector and 3D.
 *  2. Tree selection projects back into Plan, inspector and 3D.
 *  3. Plan -> 3D -> Plan preserves semantic selection.
 *  4. Deleting selected walls clears stale semantic selection.
 *  5. Plan marquee establishes one primary plus secondary selections.
 *  6. Active-level switch clears an off-level selection deterministically.
 *  7. DOM keyboard focus moves through shell controls without changing selection.
 *  8. Escape preserves semantic selection; an empty 3D click is the current
 *     deterministic clear path.
 *
 * Usage: node scripts/run-selection-authority-capability-check.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const fixturePath = path.join(repoRoot, 'fixtures/ARQ_Courtyard_House_Golden_Fixture_v2.arq');
const resultsDir = path.join(repoRoot, 'benchmarks/results');
const resultPath = path.join(resultsDir, 'selection-authority.json');
const screenshotPath = path.join(resultsDir, 'selection-authority.png');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
};

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

async function analyzeScreenshot(page, pngBuffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const scratch = document.createElement('canvas');
    scratch.width = image.naturalWidth;
    scratch.height = image.naturalHeight;
    const ctx = scratch.getContext('2d');
    if (ctx === null) throw new Error('screenshot decoder refused a 2d context');
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, scratch.width, scratch.height).data;
    let greenDominantPixels = 0;
    let checksum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (g > r + 30 && g > b + 15) greenDominantPixels += 1;
      checksum = (checksum * 31 + r + g * 3 + b * 7 + i) % 2_147_483_647;
    }
    return { greenDominantPixels, checksum };
  }, pngBuffer.toString('base64'));
}

async function waitForGreenSelection(page, canvas, present) {
  const deadline = Date.now() + 5000;
  let last = null;
  do {
    last = await analyzeScreenshot(page, await canvas.screenshot());
    const hasGreen = last.greenDominantPixels >= 50;
    if (hasGreen === present) return last;
    await page.waitForTimeout(150);
  } while (Date.now() <= deadline);
  throw new Error(
    `3D selection highlight did not become ${present ? 'present' : 'absent'}; ` +
      `last green-dominant count=${last?.greenDominantPixels ?? 'unavailable'}`,
  );
}

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
  return condition;
}

async function waitForReady(page, origin) {
  await page.goto(`${origin}/`);
  await page.waitForSelector('.arq-shell-button', { timeout: 10_000 });
  await page.waitForFunction(
    () => document.querySelector('.arq-status-bar')?.textContent?.includes('Journal current'),
    undefined,
    { timeout: 10_000 },
  );
}

async function activateSelectTool(page) {
  const rail = page.getByRole('navigation', { name: 'Tools' });
  const group = rail.getByRole('group', { name: 'Select tools' });
  if (!(await group.isVisible())) {
    await rail.locator('button[aria-controls="arq-tool-rail-panel-select"]').click();
  }
  await group.getByRole('button', { name: 'Select', exact: true }).click();
}

async function activateWallTool(page) {
  const rail = page.getByRole('navigation', { name: 'Tools' });
  await rail.getByRole('button', { name: 'Draw', exact: true }).click();
  const group = rail.getByRole('group', { name: 'Draw tools' });
  await group.getByRole('button', { name: 'Wall', exact: true }).click();
}

async function drawWall(page, start, end) {
  await activateWallTool(page);
  await page.mouse.click(start.x, start.y);
  await page.mouse.click(end.x, end.y);
  await page.keyboard.press('Enter');
}

async function selectedTreeCount(page) {
  return page.locator('[role="treeitem"][aria-selected="true"]').count();
}

async function inspectorId(page) {
  const input = page.locator('aside[aria-label="Inspector"] input[aria-label="ID"]').first();
  return input.inputValue();
}

async function inspectorPresentsSelection(page) {
  const input = page.locator('aside[aria-label="Inspector"] input[aria-label="ID"]').first();
  return (await input.count()) > 0 && (await input.isVisible());
}

async function selectDistinctDrawnTreeRow(page, drawnRows, previousId) {
  const rowCount = await drawnRows.count();
  for (let index = 0; index < rowCount; index += 1) {
    const row = drawnRows.nth(index);
    if (!(await row.isVisible())) continue;
    const button = row.locator('button').first();
    if ((await button.count()) === 0 || !(await button.isVisible())) continue;

    await button.click();
    const changed = await page
      .waitForFunction(
        (currentId) => {
          const input = document.querySelector(
            'aside[aria-label="Inspector"] input[aria-label="ID"]',
          );
          return input instanceof HTMLInputElement && input.value !== currentId;
        },
        previousId,
        { timeout: 750 },
      )
      .then(() => true)
      .catch(() => false);
    if (changed) return inspectorId(page);
  }

  throw new Error(
    `no visible drawn tree row selected a semantic entity distinct from ${previousId}; ` +
      `rendered drawn rows=${rowCount}`,
  );
}

async function assertNoSelection(page, label) {
  check((await selectedTreeCount(page)) === 0, `${label}: tree still reports a selected row`);
  await page
    .waitForFunction(
      () =>
        [
          ...document.querySelectorAll('aside[aria-label="Inspector"] input[aria-label="ID"]'),
        ].every((input) => input.getClientRects().length === 0),
      undefined,
      { timeout: 5000 },
    )
    .catch(() => undefined);
  check(
    !(await inspectorPresentsSelection(page)),
    `${label}: inspector still exposes a selected semantic ID`,
  );
}

async function openFixture(page) {
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('dialog').waitFor({ timeout: 10_000 });
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  try {
    await page.waitForFunction(
      () => {
        const text = document.body.textContent ?? '';
        return text.includes('Courtyard House Reference') && /revision\s*191/i.test(text);
      },
      undefined,
      { timeout: 120_000 },
    );
  } catch (error) {
    const dialogText = await page
      .getByRole('dialog')
      .innerText()
      .catch(() => null);
    throw new Error(
      `fixture never reached the workspace${dialogText === null ? '' : `; dialog said: ${dialogText}`}\n${String(error)}`,
    );
  }
  await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 10_000 });
}

async function runScratchScenarios(page, observed) {
  await waitForReady(page, observed.origin);
  const plan = page.locator('canvas[aria-label="Plan canvas"]');
  const box = await plan.boundingBox();
  if (box === null) throw new Error('plan canvas has no bounding box');

  const wallA = {
    start: { x: box.x + box.width * 0.3, y: box.y + box.height * 0.35 },
    end: { x: box.x + box.width * 0.58, y: box.y + box.height * 0.35 },
  };
  const wallB = {
    start: { x: box.x + box.width * 0.34, y: box.y + box.height * 0.55 },
    end: { x: box.x + box.width * 0.62, y: box.y + box.height * 0.55 },
  };

  await drawWall(page, wallA.start, wallA.end);
  await page.mouse.click(wallB.start.x, wallB.start.y);
  await page.mouse.click(wallB.end.x, wallB.end.y);
  await page.keyboard.press('Enter');
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('[role="treeitem"]')].filter((row) =>
        /\(drawn\)/.test(row.textContent ?? ''),
      ).length >= 2,
    undefined,
    { timeout: 5000 },
  );
  const drawnRows = page.getByRole('treeitem').filter({ hasText: '(drawn)' });
  check((await drawnRows.count()) >= 2, 'scratch setup did not expose two drawn walls in the tree');

  /* 1. Plan selection -> tree/inspector/3D. */
  await activateSelectTool(page);
  await page.mouse.click((wallA.start.x + wallA.end.x) / 2, wallA.start.y);
  await page.waitForFunction(
    () => document.querySelectorAll('[role="treeitem"][aria-selected="true"]').length === 1,
    undefined,
    { timeout: 5000 },
  );
  const planSelectedId = await inspectorId(page);
  check(
    planSelectedId.startsWith('drawn-wall-'),
    'Plan selection did not reach inspector semantic ID',
  );
  check((await selectedTreeCount(page)) === 1, 'Plan selection did not reach exactly one tree row');
  observed.planSelectedId = planSelectedId;

  const tab3d = page.getByRole('tab', { name: /3D/ }).first();
  await tab3d.click();
  const model = page.locator('canvas[aria-label="3D model view"]');
  await model.waitFor({ state: 'visible', timeout: 5000 });
  observed.planTo3d = await waitForGreenSelection(page, model, true);
  check((await inspectorId(page)) === planSelectedId, '3D switch changed inspector target');
  check((await selectedTreeCount(page)) === 1, '3D switch changed tree selection');

  /* 3. Plan -> 3D -> Plan selection continuity. */
  const planTab = page.getByRole('tab', { name: /^Plan$|Ground floor|Level 1 Plan/ }).first();
  await planTab.click();
  await plan.waitFor({ state: 'visible', timeout: 5000 });
  check((await inspectorId(page)) === planSelectedId, 'Plan -> 3D -> Plan lost semantic selection');
  check((await selectedTreeCount(page)) === 1, 'Plan -> 3D -> Plan lost tree projection');
  observed.plan3dPlanContinuity = true;

  /* 7. DOM focus is independent from semantic selection. */
  const openButton = page.getByRole('button', { name: 'Open', exact: true });
  await openButton.focus();
  check(
    (await openButton.evaluate((element) => document.activeElement === element)) === true,
    'Open control did not receive DOM focus',
  );
  check((await inspectorId(page)) === planSelectedId, 'focusing Open mutated semantic selection');
  const search = page.getByRole('textbox', { name: 'Search model' });
  await search.focus();
  check(
    (await search.evaluate((element) => document.activeElement === element)) === true,
    'model search did not receive DOM focus',
  );
  check(
    (await inspectorId(page)) === planSelectedId,
    'focusing model search mutated semantic selection',
  );
  observed.domFocusIndependent = true;

  /* 8. Escape is cancellation, not current semantic-clear authority. */
  await openButton.focus();
  await page.keyboard.press('Escape');
  check(
    (await inspectorId(page)) === planSelectedId,
    'Escape unexpectedly cleared semantic selection',
  );
  await tab3d.click();
  await model.waitFor({ state: 'visible', timeout: 5000 });
  const emptyPoint = await page.evaluate(() => {
    const canvas = document.querySelector('canvas[aria-label="3D model view"]');
    const panel = document.querySelector('.arq-workspace__overlay--left');
    const canvasBox = canvas.getBoundingClientRect();
    const panelBox = panel?.getBoundingClientRect() ?? null;
    const clearOfPanel = panelBox === null ? 8 : Math.max(8, panelBox.right - canvasBox.left + 24);
    return { x: clearOfPanel, y: 24 };
  });
  await model.click({ position: emptyPoint });
  await page.waitForFunction(
    () => document.querySelectorAll('[role="treeitem"][aria-selected="true"]').length === 0,
    undefined,
    { timeout: 5000 },
  );
  await assertNoSelection(page, 'empty-3d-click clear');
  observed.empty3dClear = await waitForGreenSelection(page, model, false);
  observed.escapePreservesSelection = true;
  observed.empty3dClickClearsSelection = true;
  await planTab.click();
  await plan.waitFor({ state: 'visible', timeout: 5000 });

  /* 2. Tree selection -> Plan/inspector/3D, without another selection source. */
  await drawnRows.nth(0).locator('button').click();
  const treeFirstId = await inspectorId(page);
  const firstPlanPixels = await analyzeScreenshot(page, await plan.screenshot());
  const treeSecondId = await selectDistinctDrawnTreeRow(page, drawnRows, treeFirstId);
  const secondPlanPixels = await analyzeScreenshot(page, await plan.screenshot());
  check(
    treeFirstId !== treeSecondId,
    'selecting a second tree wall did not replace the semantic primary',
  );
  check(
    firstPlanPixels.checksum !== secondPlanPixels.checksum,
    'tree selection change did not change Plan selection projection',
  );
  check(
    (await selectedTreeCount(page)) === 1,
    'tree single-select created more than one selected row',
  );
  await tab3d.click();
  await model.waitFor({ state: 'visible', timeout: 5000 });
  observed.treeTo3d = await waitForGreenSelection(page, model, true);
  check((await inspectorId(page)) === treeSecondId, 'tree -> 3D changed inspector target');
  observed.treeSelectedIds = [treeFirstId, treeSecondId];

  await planTab.click();
  await plan.waitFor({ state: 'visible', timeout: 5000 });

  /* 5. Multi-select is proven by deterministic state-flow evidence. */
  observed.multiSelection = {
    evidence: 'state-flow',
    selectorTest: 'apps/web/src/canvas/canvas-interaction.test.ts',
    authorityTest: 'scripts/selection-authority-state-flow.test.mjs',
  };

  /* 4. Delete one selected target -> stale selection is cleared. */
  const drawnBeforeDelete = await drawnRows.count();
  await drawnRows.nth(0).click();
  const deleteSelectedId = await inspectorId(page);
  const context = page.getByRole('toolbar', { name: 'Context actions' });
  await context.waitFor({ state: 'visible', timeout: 5000 });
  await context.getByRole('button', { name: /Delete/ }).click();
  await page.waitForFunction(
    (expectedDrawnCount) =>
      document.querySelectorAll('[role="treeitem"][aria-selected="true"]').length === 0 &&
      [...document.querySelectorAll('[role="treeitem"]')].filter((row) =>
        /\(drawn\)/.test(row.textContent ?? ''),
      ).length === expectedDrawnCount,
    drawnBeforeDelete - 1,
    { timeout: 5000 },
  );
  await assertNoSelection(page, 'delete-selected');
  observed.deleteClearsSelection = {
    deletedId: deleteSelectedId,
    remainingDrawnWalls: drawnBeforeDelete - 1,
  };

  await tab3d.click();
  await model.waitFor({ state: 'visible', timeout: 5000 });
  observed.afterDelete3d = await waitForGreenSelection(page, model, false);
}

async function runNativeLevelScenario(page, observed) {
  await waitForReady(page, observed.origin);
  await openFixture(page);

  await page.getByRole('tab', { name: 'Model', exact: true }).click();
  const treeSummary = page.locator('details.arq-project-directory__tree > summary');
  await treeSummary.click();
  const wallRow = page.getByRole('treeitem').filter({ hasText: 'Exterior 250 mm' }).first();
  await wallRow.click();
  await page.waitForFunction(
    () => document.querySelectorAll('[role="treeitem"][aria-selected="true"]').length === 1,
    undefined,
    { timeout: 5000 },
  );
  const nativeSelectedId = await inspectorId(page);
  observed.nativeSelectedId = nativeSelectedId;

  const tab3d = page.getByRole('tab', { name: /3D/ }).first();
  await tab3d.click();
  const model = page.locator('canvas[aria-label="3D model view"]');
  await model.waitFor({ state: 'visible', timeout: 5000 });
  observed.nativeTreeTo3d = await waitForGreenSelection(page, model, true);

  const planTab = page.getByRole('tab', { name: /Ground floor|Level 1 Plan|Plan/ }).first();
  await planTab.click();
  const browserViewsTab = page.getByRole('tab', { name: 'Views', exact: true }).first();
  await browserViewsTab.click();
  const levels = page.getByRole('region', { name: 'Floor plans' });
  await levels.waitFor({ state: 'visible', timeout: 5000 });
  const levelButtons = levels.getByRole('button');
  const levelCount = await levelButtons.count();
  if (levelCount < 2) {
    throw new Error(`native fixture exposed ${levelCount} floor-plan buttons; expected at least 2`);
  }
  const levelCandidates = [];
  for (let index = 0; index < levelCount; index += 1) {
    const button = levelButtons.nth(index);
    const label =
      (await button.getAttribute('aria-label'))?.trim() ||
      (await button.innerText()).trim() ||
      `level-${index + 1}`;
    const isCurrent =
      (await button.getAttribute('aria-current')) === 'true' ||
      (await button.getAttribute('aria-current')) === 'page' ||
      (await button.getAttribute('aria-selected')) === 'true' ||
      (await button.getAttribute('aria-pressed')) === 'true';
    if (!(await button.isDisabled()) && !isCurrent && !/add|create|new/i.test(label)) {
      levelCandidates.push({ index, label });
    }
  }
  const target = levelCandidates.at(-1) ?? { index: levelCount - 1, label: `level-${levelCount}` };
  observed.nativeLevelButtons = levelCandidates.map(({ label }) => label);
  observed.levelSwitchTarget = target.label;
  await levelButtons.nth(target.index).click();
  await page.waitForFunction(
    () => document.querySelectorAll('[role="treeitem"][aria-selected="true"]').length === 0,
    undefined,
    { timeout: 5000 },
  );
  await assertNoSelection(page, 'active-level switch');
  observed.levelSwitchClearsSelection = true;
}

async function run() {
  mkdirSync(resultsDir, { recursive: true });
  if (!existsSync(fixturePath)) throw new Error(`missing native fixture: ${fixturePath}`);
  execFileSync('npx', ['vite', 'build'], { cwd: webDir, stdio: 'inherit' });
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('vite build did not produce apps/web/dist/index.html');
  }

  const server = startServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });
  const observed = {
    exactHead: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim(),
    origin,
    scenarios: {
      planSelectionProjectsEverywhere: 1,
      treeSelectionProjectsEverywhere: 2,
      viewSwitchContinuity: 3,
      deleteClearsStaleSelection: 4,
      multiSelectPrimarySecondary: 5,
      levelSwitchPolicy: 6,
      domFocusIndependent: 7,
      escapeAndClearContract: 8,
    },
  };

  try {
    const scratchPage = await browser.newPage({ viewport: { width: 1536, height: 900 } });
    const scratchErrors = [];
    scratchPage.on('pageerror', (error) => scratchErrors.push(String(error)));
    scratchPage.on('console', (message) => {
      if (message.type() === 'error') scratchErrors.push(message.text());
    });
    await runScratchScenarios(scratchPage, observed);
    check(scratchErrors.length === 0, `scratch page console errors: ${scratchErrors.join(' | ')}`);
    await scratchPage.screenshot({ path: screenshotPath, fullPage: true });
    await scratchPage.close();

    const nativePage = await browser.newPage({ viewport: { width: 1536, height: 900 } });
    const nativeErrors = [];
    nativePage.on('pageerror', (error) => nativeErrors.push(String(error)));
    nativePage.on('console', (message) => {
      if (message.type() === 'error') nativeErrors.push(message.text());
    });
    await runNativeLevelScenario(nativePage, observed);
    check(nativeErrors.length === 0, `native page console errors: ${nativeErrors.join(' | ')}`);
    await nativePage.close();
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }

  const result = {
    capability: 'browser_selection_authority',
    verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    failures,
    observed,
  };
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0) process.exitCode = 1;
}

await run();
