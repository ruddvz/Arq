#!/usr/bin/env node
/**
 * browser_journal_recovery: proves the IndexedDB plan journal recovers a real
 * edit across a reload, against the real production apps/web bundle in real
 * headless Chromium - the closure the proof-gap registry demands
 * (engineering/ops/evidence-catalog.v5.json: "Add a browser test that edits,
 * restarts the app, confirms recovery, and distinguishes journal recovery
 * from project-file save"; engineering/32_PROOF_GAPS_AND_CLOSURE_PLAN.md,
 * "Browser journal recovery"). Runs `vite build` first (so this checks the
 * actual production bundle, same code path a user gets), serves the result
 * over plain HTTP, then drives it:
 *
 * - waits for the journal to open (status bar reports "Journal current",
 *   the label App.tsx derives from plan-journal.ts's real recover result);
 * - records the baseline drawn-wall count from the model tree (drawn walls
 *   surface as "Wall N mm (drawn)" treeitem rows - the DOM's honest count);
 * - activates the Wall tool through its real UI control (tool rail: Draw
 *   category disclosure, then the Wall tool button), not a synthetic state
 *   poke;
 * - draws one wall with real pointer events on the plan canvas and commits
 *   the chain with Enter (PlanCanvas's own commit path);
 * - polls the top bar's save-state slot until it reports "Saved locally",
 *   recording every state observed on the way (the 'saving' -> 'saved'
 *   transition is the journal append actually completing - reloading before
 *   it lands would test nothing);
 * - reloads the page and asserts the recovered condition: save state
 *   "Recovered locally", journal label "Journal current · 1 operation(s)
 *   recovered", and the drawn wall back in the model tree;
 * - asserts the recovery is journal-based, not a portable project-file save:
 *   the label names the journal, the save state names the local tier (see
 *   top-bar-state.ts: "the shell persists to a local target, not to a
 *   portable `.arq` file"), and no download was produced - the
 *   DECISION-PERSISTENCE-TIERS rule that "a journal write never implies
 *   portable-file publication", asserted rather than assumed.
 *
 * Usage: node scripts/run-journal-recovery-capability-check.mjs
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

/** The status bar is one `role="status"` strip; the journal label is one of its spans. */
const STATUS_BAR = '.arq-status-bar';
/** TopBar exposes each slot as data-top-bar-slot; save-state is the real save indicator. */
const SAVE_STATE_SLOT = '[data-top-bar-slot="save-state"]';

/** Counts the model tree's "(drawn)" rows - the DOM surface of the drawn-wall list. */
function countDrawnWallRows(page) {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('[role="treeitem"]')].filter((row) =>
        /\(drawn\)/.test(row.textContent ?? ''),
      ).length,
  );
}

function readJournalLabel(page) {
  return page.evaluate(() => {
    const spans = [...document.querySelectorAll('.arq-status-bar > span')];
    return spans.map((span) => span.textContent ?? '').find((text) => text.startsWith('Journal'));
  });
}

/**
 * Bounded poll that also records every distinct value it saw on the way to
 * the target - the observed save-state sequence goes into the result JSON,
 * so a future reader can see the real transitions (e.g. 'Saving locally…'
 * -> 'Saved locally'), not just the end state. A missed target still fails
 * after the deadline; nothing here is an unconditional sleep.
 */
async function pollTextUntil(page, readText, isDone, timeoutMs) {
  const observed = [];
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const text = await readText();
    if (typeof text === 'string' && observed[observed.length - 1] !== text) {
      observed.push(text);
    }
    if (typeof text === 'string' && isDone(text)) {
      return { reached: true, observed };
    }
    if (Date.now() > deadline) {
      return { reached: false, observed };
    }
    await page.waitForTimeout(50);
  }
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
    // 1536x900 resolves the desktop layout band, so the project browser
    // (model tree), tool rail, top bar save-state slot and status bar are
    // all docked and visible - every surface this check reads.
    const page = await browser.newPage({ viewport: { width: 1536, height: 900 } });
    const consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    // A portable project-file save would surface as a browser download; the
    // journal must not. Recording (not just asserting at the end) so the
    // result JSON names what was observed either way.
    const downloads = [];
    page.on('download', (download) => downloads.push(download.suggestedFilename()));

    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForSelector('.arq-shell-button', { timeout: 10_000 });

    // Journal open: App.tsx sets the label to 'Journal current' only after
    // plan-journal.ts's recover() resolves against real IndexedDB. A fresh
    // browser context has an empty journal, so the label must be exactly
    // 'Journal current' with no recovered-count suffix.
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.includes('Journal current'),
      STATUS_BAR,
      { timeout: 10_000 },
    );
    const baseline = {
      drawnWallRows: await countDrawnWallRows(page),
      saveStateLabel: (await page.locator(SAVE_STATE_SLOT).innerText()).trim(),
      journalLabel: await readJournalLabel(page),
    };

    // The wall tool through its real UI control: the tool rail's Draw
    // disclosure, then the Wall tool button inside the 'Draw tools' group
    // (tool-rail.tsx). aria-pressed is the rail's own active-tool state.
    const toolRail = page.getByRole('navigation', { name: 'Tools' });
    await toolRail.getByRole('button', { name: 'Draw', exact: true }).click();
    const wallButton = toolRail
      .getByRole('group', { name: 'Draw tools' })
      .getByRole('button', { name: 'Wall', exact: true });
    await wallButton.click();
    const wallToolActivated = (await wallButton.getAttribute('aria-pressed')) === 'true';

    // One wall via real pointer events: click to place each endpoint (the
    // chain tool re-arms after each placement), Enter commits the chain -
    // PlanCanvas's own commit path, which validates and journals the
    // 'add-walls' operation.
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

    // The committed wall appears in the model tree in the same React commit
    // that sets save state to 'saving' - so polling for 'Saved locally' from
    // here genuinely observes the journal append completing, not the
    // pre-edit 'saved' state.
    await page.waitForFunction(
      (expected) =>
        [...document.querySelectorAll('[role="treeitem"]')].filter((row) =>
          /\(drawn\)/.test(row.textContent ?? ''),
        ).length === expected,
      baseline.drawnWallRows + 1,
      { timeout: 5000 },
    );
    const savePoll = await pollTextUntil(
      page,
      () =>
        page
          .locator(SAVE_STATE_SLOT)
          .innerText()
          .then((text) => text.trim()),
      (text) => text === 'Saved locally',
      5000,
    );
    const afterEdit = {
      drawnWallRows: await countDrawnWallRows(page),
      drawnWallRowText: (
        await page.locator('[role="treeitem"]', { hasText: '(drawn)' }).first().innerText()
      ).trim(),
      saveStateLabel: savePoll.observed[savePoll.observed.length - 1] ?? null,
      observedSaveStates: savePoll.observed,
      journalLabel: await readJournalLabel(page),
    };

    // The restart: reload the page and let start-up recovery replay the
    // journal. Same Page object, so console/pageerror/download listeners
    // keep accumulating across the reload.
    await page.reload();
    await page.waitForSelector('.arq-shell-button', { timeout: 10_000 });
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.includes('Journal current'),
      STATUS_BAR,
      { timeout: 10_000 },
    );
    const recoveredJournalLabel = await readJournalLabel(page);
    const recoveredCountMatch = /^Journal current · (\d+) operation\(s\) recovered$/.exec(
      recoveredJournalLabel ?? '',
    );
    const afterReload = {
      drawnWallRows: await countDrawnWallRows(page),
      drawnWallRowText: (
        await page.locator('[role="treeitem"]', { hasText: '(drawn)' }).first().innerText()
      ).trim(),
      saveStateLabel: (await page.locator(SAVE_STATE_SLOT).innerText()).trim(),
      journalLabel: recoveredJournalLabel,
      recoveredOperationCount: recoveredCountMatch === null ? null : Number(recoveredCountMatch[1]),
    };

    // Journal recovery, distinguished from portable project-file save: the
    // label names the journal and its replay; the save state names the local
    // tier ('Recovered locally', never a claim that a .arq file was
    // written); no download was produced; and sync stays separately
    // 'Offline' (save and sync are separate concepts, top-bar-state.ts).
    const statusBarText = await page.locator(STATUS_BAR).innerText();
    const journalNotFileSave = {
      journalLabelNamesJournalReplay: recoveredCountMatch !== null,
      saveStateLabelNamesLocalTier: afterReload.saveStateLabel === 'Recovered locally',
      downloadsProduced: downloads,
      syncStateStaysOffline: statusBarText.includes('Offline'),
    };

    const ok =
      baseline.drawnWallRows === 0 &&
      baseline.saveStateLabel === 'Saved locally' &&
      baseline.journalLabel === 'Journal current' &&
      wallToolActivated &&
      savePoll.reached &&
      afterEdit.drawnWallRows === 1 &&
      afterEdit.journalLabel === 'Journal current' &&
      /^Wall \d+ mm \(drawn\)/.test(afterEdit.drawnWallRowText) &&
      afterReload.drawnWallRows === 1 &&
      /^Wall \d+ mm \(drawn\)/.test(afterReload.drawnWallRowText) &&
      afterReload.saveStateLabel === 'Recovered locally' &&
      // Exactly the one committed operation - the deterministic fixture the
      // proof-gap closure asks for, not merely "something recovered".
      afterReload.recoveredOperationCount === 1 &&
      journalNotFileSave.journalLabelNamesJournalReplay &&
      journalNotFileSave.saveStateLabelNamesLocalTier &&
      downloads.length === 0 &&
      journalNotFileSave.syncStateStaysOffline &&
      consoleErrors.length === 0;

    return {
      ok,
      evidenceId: 'browser_journal_recovery',
      baseline,
      wallToolActivated,
      afterEdit,
      afterReload,
      journalNotFileSave,
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

  const result = await run();
  const report = {
    timestamp: new Date().toISOString(),
    environment: `headless Chromium ${version}, real production apps/web build served over HTTP, real IndexedDB journal`,
    ...result,
  };

  console.log(JSON.stringify(report, null, 2));

  const outDir = path.join(repoRoot, 'benchmarks/results');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `journal-recovery-capability-${report.timestamp.replace(/[:.]/g, '-')}.json`,
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
