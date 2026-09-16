import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { cpus, platform, arch, release, tmpdir } from 'node:os';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { repoRoot } from './performance-authority.mjs';

export const WEB_DIST_DIR = path.join(repoRoot, 'apps/web/dist');
const CORE_PROJECT_NAME = 'Synthetic Core Workflow Project';
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};

export function ensureProductionWebBuild() {
  if (!existsSync(path.join(WEB_DIST_DIR, 'index.html'))) {
    throw new Error('apps/web/dist is absent. Run the production web build before this benchmark.');
  }
}

export function resolveChromiumExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined;
}

export function repositorySha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

export function browserEnvironment(browser) {
  return {
    browser: `Chromium ${browser.version()}`,
    engine: 'Chromium',
    os: `${platform()} ${release()} ${arch()}`,
    cpuModel: cpus()[0]?.model ?? 'unknown',
    logicalCpuCount: cpus().length,
    runner: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
    nodeVersion: process.version,
  };
}

export function startProductionWebServer() {
  const server = createServer((request, response) => {
    const requested = (request.url ?? '/').split('?')[0];
    let filePath = path.join(WEB_DIST_DIR, decodeURIComponent(requested));
    if (!filePath.startsWith(WEB_DIST_DIR)) {
      response.writeHead(403).end();
      return;
    }
    if (!existsSync(filePath) || !path.extname(filePath)) {
      filePath = path.join(WEB_DIST_DIR, 'index.html');
    }
    response.setHeader(
      'Content-Type',
      MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
    );
    response.end(readFileSync(filePath));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/**
 * Builds the single canonical repository-owned Core `.arq` fixture. The
 * short-lived Vitest bridge is necessary because the generator is TypeScript
 * and imports workspace packages; it is deliberately not a second fixture or
 * parser implementation.
 */
export function createCoreWorkflowFixture(purpose) {
  const safePurpose = purpose.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  const directory = mkdtempSync(path.join(tmpdir(), `arq-core-${safePurpose}-`));
  const fixturePath = path.join(directory, 'core-workflow.arq');
  const generatedTest = path.join(
    repoRoot,
    `scripts/_core-fixture-${safePurpose}-${process.pid}.generated.test.ts`,
  );
  const escapedFixturePath = fixturePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  writeFileSync(
    generatedTest,
    `import { it } from 'vitest';\nimport { writeCoreWorkflowArqFile } from '../benchmarks/fixtures/core-workflow-product-fixture';\n\nit('writes the canonical Core workflow fixture for ${safePurpose}', async () => {\n  await writeCoreWorkflowArqFile('${escapedFixturePath}');\n});\n`,
  );
  try {
    execFileSync('npx', ['vitest', 'run', generatedTest, '--coverage=false'], {
      cwd: repoRoot,
      stdio: 'inherit',
    });
  } finally {
    rmSync(generatedTest, { force: true });
  }
  if (!existsSync(fixturePath)) {
    rmSync(directory, { recursive: true, force: true });
    throw new Error('Core fixture generator did not produce its .arq file.');
  }
  return {
    fixturePath,
    cleanup() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

/** Project open is setup only for view-level #402 measurements while #361 owns open/adopt timing. */
export async function openCoreWorkflowProject(page, origin, fixturePath) {
  await page.goto(origin, { waitUntil: 'load' });
  await page.waitForSelector('.arq-shell-button', { state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: 'Open' }).click();
  const dialog = page.getByRole('dialog', { name: 'Open project' });
  await dialog.waitFor({ state: 'visible', timeout: 10_000 });
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
  await page
    .getByRole('button', { name: new RegExp(`^Project name: ${CORE_PROJECT_NAME}\\.`) })
    .waitFor({ state: 'visible', timeout: 30_000 });
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
}

export async function analyzeCanvasPixels(page, pngBuffer) {
  return page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const scratch = document.createElement('canvas');
    scratch.width = image.naturalWidth;
    scratch.height = image.naturalHeight;
    const context = scratch.getContext('2d');
    if (context === null) throw new Error('screenshot decoder refused a 2D context');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, scratch.width, scratch.height).data;
    const colors = new Set();
    let greenDominantPixels = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      colors.add((red << 16) | (green << 8) | blue);
      if (green > red + 18 && green > blue + 12) greenDominantPixels += 1;
    }
    return {
      uniqueColors: colors.size,
      greenDominantPixels,
      width: scratch.width,
      height: scratch.height,
    };
  }, pngBuffer.toString('base64'));
}

export async function validateRenderedWebglCanvas(page, modelCanvas, label) {
  const surface = await modelCanvas.evaluate((canvas) => ({
    clientWidth: canvas.clientWidth,
    clientHeight: canvas.clientHeight,
    is2dContext: canvas.getContext('2d') !== null,
    isWebgl2Context: canvas.getContext('webgl2') !== null,
  }));
  const pixels = await analyzeCanvasPixels(page, await modelCanvas.screenshot());
  if (
    surface.clientWidth <= 0 ||
    surface.clientHeight <= 0 ||
    surface.is2dContext ||
    !surface.isWebgl2Context ||
    pixels.uniqueColors <= 1
  ) {
    throw new Error(`${label} did not produce a valid rendered WebGL2 frame.`);
  }
  return { surface, pixels };
}
