#!/usr/bin/env node
/**
 * Proves that sheet export still works after being moved behind a dynamic
 * import, and that the deferral is real rather than nominal.
 *
 * The export used to be a static import in App.tsx, which put pdf-lib and its
 * font and text-encoding tables into the start-up chunk: every reader
 * downloaded a PDF writer in order to draw a wall. Moving it behind
 * `await import()` inside the export handler took the entry chunk from
 * 1,762kB raw / 743kB gzipped to 754kB / 235kB.
 *
 * That change traded a build-time guarantee for a run-time one. A broken static
 * import fails the build; a broken dynamic import fails silently until a user
 * clicks Export, which is the worst possible place to discover it. The bundle
 * budget check (scripts/check-web-bundle-budget.mjs) proves the bytes left the
 * entry chunk. It cannot prove they are still reachable. This does.
 *
 * Three observables, in the order that makes them meaningful:
 *
 *   1. The sheet-export chunk is NOT fetched during load and first interaction.
 *      Without this, "it exports" would also be true of the version that
 *      shipped the writer to everyone, and the check would pass while the
 *      regression it exists to catch was live.
 *   2. It IS fetched once the export command runs. That is the dynamic import
 *      resolving against the real built bundle over HTTP, not a bundler graph.
 *   3. The download is a real PDF, checked by its %PDF- signature and its
 *      trailer, not by the file name the browser was handed.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

/** See run-model-canvas-capability-check.mjs: sandbox path, then Playwright's own resolution. */
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

/** Matches the chunk Vite emits for apps/web/src/sheets/sheet-export.ts. */
const SHEET_CHUNK = /\/assets\/sheet-export-[^/]+\.js$/;

/**
 * Inflates every Flate stream in a PDF and returns their concatenated text.
 *
 * Deliberately tolerant: it walks `stream`/`endstream` pairs and tries to
 * inflate each, ignoring the ones that fail. Some streams are not Flate, and a
 * PDF writer is free to change which are, so a strict parser here would be a
 * second thing to maintain and a new way for this check to fail for reasons
 * that have nothing to do with sheet export. inflateSync is used rather than a
 * PDF library so this script keeps adding no dependency.
 */
function inflateStreams(bytes) {
  const latin1 = bytes.toString('latin1');
  const parts = [];
  let count = 0;
  const pattern = /stream\r?\n?/g;
  let match;
  while ((match = pattern.exec(latin1)) !== null) {
    const start = match.index + match[0].length;
    const end = latin1.indexOf('endstream', start);
    if (end === -1) continue;
    try {
      parts.push(inflateSync(bytes.subarray(start, end)).toString('latin1'));
      count += 1;
    } catch {
      // Not a Flate stream, or not one on its own: nothing to read here.
    }
  }
  return { text: parts.join('\n'), count };
}

/**
 * Expands PDF hex strings in place and drops NUL bytes, so a plain
 * `includes()` finds a value however the writer chose to encode it. Only
 * plausible hex-string bodies are touched: an even number of hex digits,
 * long enough not to be an ordinary `<<` dictionary delimiter.
 */
function decodeForSearch(raw) {
  const expanded = raw.replace(/<((?:[0-9A-Fa-f]{2}){4,})>/g, (whole, hex) => {
    try {
      return `${whole} ${Buffer.from(hex, 'hex').toString('latin1')}`;
    } catch {
      return whole;
    }
  });
  return expanded.replace(/\0/g, '');
}

async function main() {
  execFileSync('npx', ['vite', 'build'], { cwd: webDir, stdio: 'inherit' });
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('vite build did not produce apps/web/dist/index.html');
  }

  const server = startServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ executablePath: resolveChromiumExecutablePath() });
  const failures = [];
  const observed = {};

  try {
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    /*
     * Both the raw URL and its pathname are kept. Pathname alone is wrong for
     * the off-origin question: a download arrives as `blob:http://origin/uuid`,
     * whose pathname is the whole inner URL, so a naive "does it start with
     * http" test flags the app's own download as leaving the origin. Origin is
     * decided from the scheme and host instead, and blob/data URLs are by
     * definition not network requests.
     */
    const requested = [];
    page.on('request', (request) => {
      const url = request.url();
      requested.push({ url, path: url.startsWith('blob:') ? url : new URL(url).pathname });
    });
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto(origin, { waitUntil: 'networkidle' });

    // Draw one wall, because the export command is disabled until the plan has
    // something on it - "Draw something or open a project to export a sheet".
    // Drawing is the cheaper of the two ways to satisfy that.
    const toolRail = page.getByRole('navigation', { name: 'Tools' });
    await toolRail.getByRole('button', { name: 'Draw', exact: true }).click();
    await toolRail
      .getByRole('group', { name: 'Draw tools' })
      .getByRole('button', { name: 'Wall', exact: true })
      .click();
    const planCanvas = page.locator('canvas[aria-label="Plan canvas"]');
    const box = await planCanvas.boundingBox();
    if (box === null) throw new Error('plan canvas has no bounding box');
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
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('[role="treeitem"]')].some((row) =>
          /\(drawn\)/.test(row.textContent ?? ''),
        ),
      null,
      { timeout: 5000 },
    );

    // (1) Nothing so far should have pulled the PDF writer over the wire.
    observed.sheetChunkBeforeExport = requested
      .filter((r) => SHEET_CHUNK.test(r.path))
      .map((r) => r.path);
    if (observed.sheetChunkBeforeExport.length > 0) {
      failures.push(
        'the sheet-export chunk was fetched before the export command ran, so it is not ' +
          `actually deferred: ${observed.sheetChunkBeforeExport.join(', ')}`,
      );
    }

    // (2) Run the real command through the real palette.
    // Addressed by accessible name throughout, so this also fails if the
    // palette loses the combobox/listbox semantics it is built on.
    await page.keyboard.press('Control+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await palette.getByRole('combobox', { name: 'Search commands' }).fill('Export sheet');
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await palette
      .getByRole('option', { name: /Export sheet as PDF/ })
      .first()
      .click();
    const download = await downloadPromise;

    observed.sheetChunkAfterExport = requested
      .filter((r) => SHEET_CHUNK.test(r.path))
      .map((r) => r.path);
    if (observed.sheetChunkAfterExport.length === 0) {
      failures.push(
        'the export produced a download without ever fetching the sheet-export chunk, which ' +
          'means the code is still in the entry bundle under another name',
      );
    }

    // (3) A PDF, established from the bytes rather than the file name.
    const streamPath = await download.path();
    const bytes = readFileSync(streamPath);
    observed.fileName = download.suggestedFilename();
    observed.byteLength = bytes.length;
    observed.signature = bytes.subarray(0, 5).toString('latin1');
    observed.hasTrailer = bytes.subarray(-2048).toString('latin1').includes('%%EOF');

    /*
     * What is in the page, not how big the file is.
     *
     * A byte threshold is a poor proxy for "something was drawn", and the first
     * version of this check proved it by failing a perfectly good 923-byte
     * sheet; sheet-export.test.ts sets its own floor at 500. Searching the raw
     * bytes for `/Type /Page` is no better: pdf-lib writes object streams by
     * default, so the page object is inside a Flate stream and invisible to a
     * text search. Asserting on that would have been asserting on a
     * serialisation setting.
     *
     * So the streams are inflated and the drawing operators are read out of the
     * page content itself. `re`/`m`+`l` with a paint operator is a real path;
     * `Tj`/`TJ` is real text. Together they distinguish a composed sheet from a
     * structurally valid empty page, which is the distinction that matters.
     */
    const inflated = inflateStreams(bytes);
    observed.inflatedStreams = inflated.count;
    const content = inflated.text;
    observed.hasPageObject = /\/Type\s*\/Page(?![s])/.test(content + bytes.toString('latin1'));
    observed.hasPathOperators =
      /(?:^|\s)(?:re|[ml])(?:\s|$)/m.test(content) && /\s[SsfFB]\s/.test(content);
    /*
     * Sheet identity is metadata, not drawing. applySheetExportMetadata puts
     * the number, title and revision into the document information dictionary;
     * nothing paints a title block onto the page, and text is only drawn for
     * text primitives the scene actually contains. An earlier version of this
     * check asserted drawn text and failed a correct export of a plan with one
     * wall and no notes - it was asserting a title block the implementation
     * deliberately does not draw.
     */
    /*
     * The sheet number has to be hunted through two layers of encoding, which
     * is why this is a helper rather than a substring test. pdf-lib writes
     * document information strings as UTF-16BE - "A101" becomes
     * 00 41 00 31 00 30 00 31 - and wraps them as PDF hex strings, so in the
     * file they read as ASCII "<FEFF0041003100300031>". Neither a plain latin1
     * search nor NUL-stripping alone finds that. Hex strings are decoded first,
     * then NULs are dropped, which collapses every representation onto one
     * needle without needing to know which the writer chose.
     */
    const searchable = decodeForSearch(`${content}\n${bytes.toString('latin1')}`);
    observed.carriesSheetNumber = searchable.includes('A101');

    if (observed.signature !== '%PDF-') {
      failures.push(`the downloaded file does not start with %PDF- (got ${observed.signature})`);
    }
    if (!observed.hasTrailer) {
      failures.push('the downloaded PDF has no %%EOF trailer, so it was truncated');
    }
    if (!observed.hasPageObject) {
      failures.push('the downloaded PDF declares no page object, so nothing was composed onto it');
    }
    if (!observed.hasPathOperators) {
      failures.push(
        'the page content has no painted path operators, so the drawing is empty - a sheet ' +
          'with a wall on it must stroke or fill something',
      );
    }
    if (!observed.carriesSheetNumber) {
      failures.push(
        'the exported PDF does not carry its sheet number anywhere, so the file cannot be ' +
          'identified as the sheet it was exported from',
      );
    }
    if (bytes.length < 500) {
      failures.push(
        `the downloaded PDF is only ${bytes.length} bytes, below the floor sheet-export.test.ts sets`,
      );
    }

    observed.consoleErrors = consoleErrors;
    if (consoleErrors.length > 0) {
      failures.push(`console errors during export: ${consoleErrors.join(' | ')}`);
    }

    observed.offOriginRequests = requested
      .filter((r) => !r.url.startsWith('blob:') && !r.url.startsWith('data:'))
      .filter((r) => new URL(r.url).origin !== origin)
      .map((r) => r.url);
    if (observed.offOriginRequests.length > 0) {
      failures.push(`requests left the origin: ${observed.offOriginRequests.join(', ')}`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  const result = {
    evidenceId: 'browser_sheet_export',
    timestamp: new Date().toISOString(),
    environment:
      'headless Chromium - the vite-built apps/web bundle served over plain HTTP, driven through its real command palette',
    observed,
    failures,
    ok: failures.length === 0,
    limitation:
      'Chromium only. Proves that the deferred sheet-export chunk is absent until the export command runs, that the command then fetches it and produces a real PDF, and that no console error occurs. Proves nothing about the PDF s visual fidelity, fonts, line weights or paper size, which sheet-export.test.ts and SHEET_EXPORT_LIMITATIONS cover.',
  };

  mkdirSync(resultsDir, { recursive: true });
  const outPath = path.join(
    resultsDir,
    `sheet-export-capability-${result.timestamp.replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\nSaved to ${outPath}\n`);
  if (!result.ok) process.exit(1);
}

await main();
