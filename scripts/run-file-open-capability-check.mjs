#!/usr/bin/env node
/**
 * UI-011: proves FileOpenPanel's byte-safe compatibility gate against real
 * files in a real browser, not by inspecting the source and assuming
 * @arq/arqfs's preflight logic reaches the UI correctly. Generates three real
 * fixtures via the actual Node arqfs driver (not hand-built byte arrays):
 *
 * - a genuinely valid arqfs project;
 * - the same project with 200 bytes truncated off the end;
 * - a real SQLite database that is not an Arq project at all.
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
  const good = \`\${outDir}/good.arq\`;
  const driver = createNodeArqfsDriver(good);
  createArqfsSchemaV1(driver);
  putArchiveEntry(driver, 'manifest.json', new TextEncoder().encode('{"project":"fixture"}'));
  driver.close();

  const fullBytes = readFileSync(good);
  writeFileSync(\`\${outDir}/truncated.arq\`, fullBytes.subarray(0, fullBytes.byteLength - 200));

  const otherDriver = createNodeArqfsDriver(\`\${outDir}/other.sqlite3\`);
  otherDriver.exec('CREATE TABLE unrelated (id INTEGER PRIMARY KEY)');
  otherDriver.close();
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
  };
}

async function run() {
  execFileSync('npx', ['vite', 'build'], { cwd: webDir, stdio: 'inherit' });
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('vite build did not produce apps/web/dist/index.html');
  }

  const fixtureDir = mkdtempSync(path.join(tmpdir(), 'file-open-capability-'));
  const { goodPath, truncatedPath, otherPath } = writeFixtures(fixtureDir);

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

    await fileInput.setInputFiles(truncatedPath);
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.includes('could not be opened'),
      STATUS,
      { timeout: 5000 },
    );
    const truncatedHeadline = await page.locator(`${STATUS} p`).first().textContent();
    await page.locator(`${STATUS} summary`).click();
    const truncatedDetail = await page.locator(`${STATUS} details p`).textContent();

    await page.getByRole('button', { name: 'Choose another file' }).click();
    await fileInput.setInputFiles(goodPath);
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.includes('compatible Arq project'),
      STATUS,
      { timeout: 5000 },
    );
    const validHeadline = await page.locator(`${STATUS} p`).first().textContent();

    await page.getByRole('button', { name: 'Choose another file' }).click();
    await fileInput.setInputFiles(otherPath);
    await page.waitForFunction(
      (sel) => document.querySelector(sel)?.textContent?.includes('could not be opened'),
      STATUS,
      { timeout: 5000 },
    );
    const nonArqHeadline = await page.locator(`${STATUS} p`).first().textContent();
    await page.locator(`${STATUS} summary`).click();
    const nonArqDetail = await page.locator(`${STATUS} details p`).textContent();

    const ok =
      truncatedHeadline.includes('could not be opened') &&
      truncatedDetail.includes('ARQ_FILE_TRUNCATED') &&
      validHeadline.includes('compatible Arq project') &&
      nonArqHeadline.includes('could not be opened') &&
      nonArqDetail.includes('NOT_ARQ_SQLITE') &&
      consoleErrors.length === 0;

    return {
      ok,
      truncatedFile: { headline: truncatedHeadline, detail: truncatedDetail },
      validFile: { headline: validHeadline },
      nonArqSqliteFile: { headline: nonArqHeadline, detail: nonArqDetail },
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
