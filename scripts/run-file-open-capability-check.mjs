#!/usr/bin/env node
/**
 * UI-011: proves FileOpenPanel's byte-safe compatibility gate against real
 * files in a real browser, not by inspecting the source and assuming
 * @arq/arqfs's preflight logic reaches the UI correctly. Generates four real
 * fixtures via the actual Node arqfs driver (not hand-built byte arrays):
 *
 * - a genuinely valid arqfs project;
 * - the same project with 200 bytes truncated off the end;
 * - a real SQLite database that is not an Arq project at all;
 * - a real write-ahead-log project copied without its -wal sidecar, the way a
 *   file picker hands one over while the writing application still holds it.
 *
 * Then drives the real production apps/web bundle in headless Chromium:
 * opens the Open-project dialog through its real trigger button, uploads
 * each fixture through the real file input, and asserts the UI shows the
 * real diagnostic code/reason preflightArqfsBytes and routeBrowserFile
 * actually produced - not a placeholder, not "something went wrong".
 *
 * Usage: node scripts/run-file-open-capability-check.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
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
  // Required, not cosmetic: `WebAssembly.instantiateStreaming` refuses anything
  // that is not `application/wasm`, so serving sqlite-wasm as
  // application/octet-stream makes the Worker fail to start and the open path
  // hang. That only became reachable once apps/web actually bundled the Worker.
  '.wasm': 'application/wasm',
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
 * Generates the fixtures through the real Node arqfs driver (better-sqlite3),
 * not a hand-built byte array standing in for one. Runs as a throwaway vitest
 * test rather than importing @arq/arqfs directly into this plain Node script:
 * the package's own module graph only resolves cleanly through TypeScript's
 * "Bundler" module resolution (vitest/tsc), not Node's native ESM resolver,
 * which requires explicit file extensions on every relative import.
 */
function writeFixtures(dir) {
  const testFilePath = path.join(
    repoRoot,
    'packages/arqfs/src/_file-open-fixtures.generated.test.ts',
  );
  const escapedDir = dir.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  writeFileSync(
    testFilePath,
    `import { it } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { createNodeArqfsDriver } from './arqfs-node-driver';
import { createArqfsSchemaV1 } from './arqfs-schema';
import { putArchiveEntry } from './arqfs-archive-store';

const outDir = '${escapedDir}';

it('generates real arqfs fixtures for scripts/run-file-open-capability-check.mjs', () => {
  // A real project, not merely a real database. The flow now opens what it
  // accepts, so a fixture carrying no manifest and no model would be refused at
  // the archive stage - correctly - and the positive case would prove nothing
  // about opening. manifest.json and model.json are the two entries
  // importArchive requires; checksums.json is optional.
  const good = \`\${outDir}/good.arq\`;
  const driver = createNodeArqfsDriver(good);
  createArqfsSchemaV1(driver);
  const encode = (value) => new TextEncoder().encode(JSON.stringify(value));
  putArchiveEntry(
    driver,
    'manifest.json',
    encode({
      schemaVersion: 0,
      applicationVersion: 'capability-check',
      projectId: '00000000-0000-4000-8000-0000000000fx'.replace('fx', '01'),
      createdAt: '2026-08-04T00:00:00.000Z',
    }),
  );
  putArchiveEntry(
    driver,
    'model.json',
    encode({
      projectName: 'Capability check project',
      walls: [{ id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 } }],
    }),
  );
  driver.close();

  const fullBytes = readFileSync(good);
  writeFileSync(\`\${outDir}/truncated.arq\`, fullBytes.subarray(0, fullBytes.byteLength - 200));

  const otherDriver = createNodeArqfsDriver(\`\${outDir}/other.sqlite3\`);
  otherDriver.exec('CREATE TABLE unrelated (id INTEGER PRIMARY KEY)');
  otherDriver.close();

  // A real write-ahead-log project, copied the way a file picker hands one over:
  // the main database only, while its -wal sidecar still holds committed work.
  // Not a byte-patched header - the connection is left open so SQLite has not
  // checkpointed, which is exactly the state a user's project is in when they
  // pick it out of a folder while the writing application still has it open.
  const walSource = \`\${outDir}/wal-source.arq\`;
  const walDriver = createNodeArqfsDriver(walSource);
  createArqfsSchemaV1(walDriver);
  walDriver.exec('PRAGMA journal_mode=WAL');
  putArchiveEntry(walDriver, 'manifest.json', new TextEncoder().encode('{"project":"wal"}'));
  writeFileSync(\`\${outDir}/wal-dependent.arq\`, readFileSync(walSource));
  walDriver.close();
});
`,
  );
  try {
    execFileSync('npx', ['vitest', 'run', testFilePath, '--coverage=false'], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
  } finally {
    rmSync(testFilePath, { force: true });
  }
  return {
    goodPath: path.join(dir, 'good.arq'),
    truncatedPath: path.join(dir, 'truncated.arq'),
    otherPath: path.join(dir, 'other.sqlite3'),
    walDependentPath: path.join(dir, 'wal-dependent.arq'),
  };
}

async function run() {
  execFileSync('npx', ['vite', 'build'], { cwd: webDir, stdio: 'inherit' });
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('vite build did not produce apps/web/dist/index.html');
  }

  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'file-open-capability-'));
  const { goodPath, truncatedPath, otherPath, walDependentPath } = writeFixtures(fixtureDir);

  const server = startServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const consoleErrors = [];
    page.on('pageerror', (error) => consoleErrors.push(String(error)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForSelector('.arq-shell-button', { timeout: 10_000 });

    await page.getByRole('button', { name: 'Open' }).click();
    const dialog = page.getByRole('dialog', { name: 'Open project' });
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    const STATUS = '[role="dialog"] [role="status"]';
    const fileInput = page.locator('input[type="file"]');

    /**
     * A bare Playwright `TimeoutError` says only that the wait expired - not
     * what the product actually reported, which is the one thing needed to fix
     * it. This re-throws with the live status text and any console/page errors
     * attached, so a failing run is diagnosable from its own output instead of
     * requiring the script to be re-instrumented by hand.
     */
    async function waitForStatus(needle, label) {
      try {
        await page.waitForFunction(
          ([sel, text]) => document.querySelector(sel)?.textContent?.includes(text),
          [STATUS, needle],
          { timeout: 15_000 },
        );
      } catch (error) {
        const shown = await page
          .locator(STATUS)
          .textContent()
          .catch(() => '<no status element>');
        throw new Error(
          `${label}: waited for ${JSON.stringify(needle)} but the panel showed ` +
            `${JSON.stringify(shown)}.\nBrowser errors:\n${
              consoleErrors.length > 0 ? consoleErrors.join('\n') : '  (none)'
            }`,
          { cause: error },
        );
      }
    }

    // WCAG 2.5.3 (Label in Name, Level A): a control's accessible name must
    // contain its own visible text, so a voice-control user can activate it by
    // speaking the label they can see. This regressed once already - an
    // aria-label of "Choose a file to open, or drop it here" over visible text
    // "Choose a file or drop it here" silently broke the match, and nothing
    // caught it because the control still worked by mouse and keyboard.
    const dropZone = page.locator('[role="dialog"] [role="button"]').first();
    const dropZoneVisibleText = (await dropZone.innerText()).trim();
    const dropZoneAccessibleName = (
      await dropZone.evaluate((el) => el.getAttribute('aria-label') ?? el.textContent ?? '')
    ).trim();
    const labelInNameHolds =
      dropZoneVisibleText.length > 0 &&
      dropZoneAccessibleName.toLowerCase().includes(dropZoneVisibleText.toLowerCase());

    await fileInput.setInputFiles(truncatedPath);
    await waitForStatus('could not be opened', 'truncated fixture');
    const truncatedHeadline = await page.locator(`${STATUS} p`).first().textContent();
    await page.locator(`${STATUS} summary`).click();
    const truncatedDetail = await page.locator(`${STATUS} details p`).textContent();

    await page.getByRole('button', { name: 'Choose another file' }).click();
    await fileInput.setInputFiles(otherPath);
    await waitForStatus('could not be opened', 'non-Arq SQLite fixture');
    const nonArqHeadline = await page.locator(`${STATUS} p`).first().textContent();
    await page.locator(`${STATUS} summary`).click();
    const nonArqDetail = await page.locator(`${STATUS} details p`).textContent();

    // The silent-staleness case, which this instrument did not cover at all
    // until now: SQLite opens a WAL database without its sidecar and serves the
    // last checkpoint, so the product must refuse it rather than present it as
    // an openable project. Proving that in a real browser is the point - the
    // policy is enforced from bytes, and a unit test cannot show that the bytes
    // a file picker hands over actually reach it.
    await page.getByRole('button', { name: 'Choose another file' }).click();
    await fileInput.setInputFiles(walDependentPath);
    await waitForStatus('could not be opened', 'WAL-dependent fixture');
    const walHeadline = await page.locator(`${STATUS} p`).first().textContent();
    await page.locator(`${STATUS} summary`).click();
    const walDetail = await page.locator(`${STATUS} details p`).textContent();

    // The accepting case, and deliberately last: opening a project is terminal
    // in this product. The workspace adopts it and closes the dialog, so the
    // panel's own "… is open." message is not where the evidence lives - it is
    // on screen for only as long as the dialog it sits in. The workspace
    // showing the project's own name is the stronger claim anyway: it proves
    // the Worker was constructed, the bytes were imported into an OPFS working
    // copy, the database was opened through sqlite-wasm, the archive decoded
    // and the model reached the canvas. None of that could happen before the
    // open path was wired.
    await page.getByRole('button', { name: 'Choose another file' }).click();
    await fileInput.setInputFiles(goodPath);
    /*
     * Matched on the control's accessible name rather than by intersecting it
     * with a text locator.
     *
     * The bar sets the name on its own line above the project's revision and
     * units now, so the words live in a child span and `.and(getByText(...))` -
     * which needs both locators to resolve to the *same* element - stopped
     * matching the button. The accessible name is the better assertion anyway:
     * it is what a screen reader announces, and it cannot drift as the visual
     * structure does.
     */
    const projectNameControl = page.getByRole('button', {
      name: /^Project name: Capability check project\./,
    });
    try {
      await projectNameControl.waitFor({ state: 'visible', timeout: 15_000 });
    } catch (error) {
      throw new Error(
        `valid project fixture: the workspace never adopted the project. Panel showed ` +
          `${JSON.stringify(
            await page
              .locator(STATUS)
              .textContent()
              .catch(() => null),
          )}.\n` +
          `Browser errors:\n${consoleErrors.length > 0 ? consoleErrors.join('\n') : '  (none)'}`,
        { cause: error },
      );
    }
    const adoptedProjectName = (await projectNameControl.textContent()).trim();
    // Adoption dismisses the picker rather than leaving it over the project the
    // user just asked to see.
    await dialog.waitFor({ state: 'hidden', timeout: 5000 });

    // Reopening must offer a picker, not the last file's verdict. The panel is
    // closed by the workspace here, not by its own dismiss handler, so this is
    // the case where a reset attached to that handler would silently not run.
    await page.getByRole('button', { name: 'Open' }).click();
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    const reopenedStatus = (await page.locator(STATUS).textContent()).trim();

    const ok =
      truncatedHeadline.includes('could not be opened') &&
      truncatedDetail.includes('ARQ_FILE_TRUNCATED') &&
      adoptedProjectName === 'Capability check project' &&
      !reopenedStatus.includes('is open') &&
      !reopenedStatus.includes('could not be opened') &&
      walHeadline.includes('could not be opened') &&
      walDetail.includes('ARQ_WAL_SIDECAR_REQUIRED') &&
      // The refusal has to carry the remedy, not only the fault.
      walDetail.includes('close it cleanly') &&
      nonArqHeadline.includes('could not be opened') &&
      nonArqDetail.includes('NOT_ARQ_SQLITE') &&
      labelInNameHolds &&
      consoleErrors.length === 0;

    return {
      ok,
      truncatedFile: { headline: truncatedHeadline, detail: truncatedDetail },
      validFile: { adoptedProjectName, dialogDismissedOnAdoption: true, reopenedStatus },
      nonArqSqliteFile: { headline: nonArqHeadline, detail: nonArqDetail },
      walDependentFile: { headline: walHeadline, detail: walDetail },
      accessibility: {
        dropZoneVisibleText,
        dropZoneAccessibleName,
        labelInNameHolds,
      },
      consoleErrors,
    };
  } finally {
    await browser.close();
    server.close();
    rmSync(fixtureDir, { recursive: true, force: true });
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
    environment: `headless Chromium ${version}, real production apps/web build, real arqfs fixtures from the Node driver`,
    ...result,
  };

  console.log(JSON.stringify(report, null, 2));

  const outDir = path.join(repoRoot, 'benchmarks/results');
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `file-open-capability-${report.timestamp.replace(/[:.]/g, '-')}.json`,
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
