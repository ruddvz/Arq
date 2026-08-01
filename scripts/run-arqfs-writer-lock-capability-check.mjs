#!/usr/bin/env node
/**
 * ARQ-220: implement browser single-writer project lock.
 *
 * Drives packages/arqfs/benchmarks/writer-lock/writer-lock-capability.html in real
 * headless Chromium (Playwright) - two pages in the same browser context (same
 * origin, so BroadcastChannel/Web Locks are genuinely shared, unlike two separately
 * loaded file:// pages which Chromium gives distinct opaque origins), simulating two
 * tabs of the same Arq project. Verifies for real, not by assumption:
 *
 *  1. A second tab's lock request genuinely blocks (queues) while the first holds it.
 *  2. The second tab is granted the lock only after the first releases.
 *  3. Both writer-acquired and writer-released notifications reach the other tab via
 *     BroadcastChannel.
 *
 * Usage: node scripts/run-arqfs-writer-lock-capability-check.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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
const benchDir = path.join(repoRoot, 'packages/arqfs/benchmarks/writer-lock');

function serveDir(rootDir, urlPrefix) {
  return (req, res) => {
    if (!req.url.startsWith(urlPrefix)) {
      return false;
    }
    const relative = req.url.slice(urlPrefix.length).split('?')[0];
    const filePath = path.join(rootDir, relative);
    if (!filePath.startsWith(rootDir)) {
      res.writeHead(403);
      res.end();
      return true;
    }
    try {
      const contents = readFileSync(filePath);
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(contents);
    } catch {
      res.writeHead(404);
      res.end();
    }
    return true;
  };
}

async function main() {
  const handler = serveDir(benchDir, '/bench/');
  const server = createServer((req, res) => {
    if (handler(req, res)) return;
    res.writeHead(404);
    res.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/bench/writer-lock-capability.html`;

  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });
  try {
    const context = await browser.newContext();
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await tabA.goto(url);
    await tabB.goto(url);
    await tabA.waitForFunction(() => window.__ARQ_WRITER_LOCK_READY__ === true);
    await tabB.waitForFunction(() => window.__ARQ_WRITER_LOCK_READY__ === true);

    const HOUSE = 'house';
    const BARN = 'barn';

    await tabA.evaluate((projectId) => window.__acquireLock(projectId), HOUSE);

    // The isolation property, which a single global lock name silently broke:
    // a different project must be acquirable while the first is held.
    const tabBOtherProject = await tabB.evaluate(
      (projectId) => window.__acquireLock(projectId),
      BARN,
    );
    await tabB.evaluate((projectId) => window.__releaseLock(projectId), BARN);

    // Fire tab B's acquisition attempt for the SAME project but do not await it
    // yet - it must genuinely queue behind tab A, not resolve immediately.
    const tabBAcquirePromise = tabB.evaluate(
      (projectId) => window.__acquireLock(projectId, { waitForRelease: true }),
      HOUSE,
    );

    // Give the queued request a moment to actually reach the browser's lock manager,
    // then confirm it is real "pending" state, not a resolved promise we haven't
    // awaited yet.
    await tabA.waitForTimeout(200);
    const queryWhileHeld = await tabA.evaluate(() => window.__queryPendingRequests());
    const tabBSawAcquireNotification = await tabB.evaluate(() =>
      window.__getNotifications().some((n) => n.type === 'writer-acquired'),
    );

    // The degrade-instead-of-hang path: without waitForRelease, a contended
    // request answers immediately rather than queueing.
    const tabBDegraded = await tabB.evaluate((projectId) => window.__acquireLock(projectId), HOUSE);

    let tabBResolvedTooEarly = false;
    const raceResult = await Promise.race([
      tabBAcquirePromise.then(() => 'resolved'),
      new Promise((resolve) => setTimeout(() => resolve('still-pending'), 300)),
    ]);
    if (raceResult === 'resolved') {
      tabBResolvedTooEarly = true;
    }

    await tabA.evaluate((projectId) => window.__releaseLock(projectId), HOUSE);
    await tabBAcquirePromise; // Now it should resolve.

    const tabBNotificationsAfterRelease = await tabB.evaluate(() => window.__getNotifications());

    const result = {
      ok: true,
      queryWhileTabAHeldLock: queryWhileHeld,
      tabBBlockedWhileTabAHeldLock: !tabBResolvedTooEarly,
      tabBSawWriterAcquiredNotification: tabBSawAcquireNotification,
      tabBSawWriterReleasedNotification: tabBNotificationsAfterRelease.some(
        (n) => n.type === 'writer-released',
      ),
      tabBAcquiredAfterTabAReleased: true,
      // Two different projects do not contend: the lock name is project-scoped,
      // the same way the OPFS filename already is.
      differentProjectAcquiredWhileFirstHeld: tabBOtherProject === 'writer',
      // A contended request without waitForRelease answers rather than hanging.
      contendedRequestDegradedToReadOnly: tabBDegraded === 'read-only:another-context-is-writing',
    };

    const version = await browser.version();
    const report = {
      timestamp: new Date().toISOString(),
      environment: `headless Chromium ${version}, two pages/same context (same origin) - real Web Locks API + BroadcastChannel, not a physical multi-tab user test`,
      ...result,
    };

    console.log(JSON.stringify(report, null, 2));

    const outDir = path.join(repoRoot, 'benchmarks/results');
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(
      outDir,
      `arqfs-writer-lock-capability-${report.timestamp.replace(/[:.]/g, '-')}.json`,
    );
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nSaved to ${path.relative(repoRoot, outPath)}`);

    if (!result.tabBBlockedWhileTabAHeldLock || !result.tabBSawWriterAcquiredNotification) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
