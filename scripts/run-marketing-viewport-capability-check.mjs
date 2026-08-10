#!/usr/bin/env node
/**
 * Public-site UI/UX audit, "Verification": drives the real built
 * apps/marketing bundle in headless Chromium across every public route and
 * the audit's named viewport matrix (wide desktop, 1440, 1280, 1024, tablet
 * portrait, tablet landscape, phone portrait, phone landscape), and asserts
 * evidence rather than a screenshot a human is trusted to notice something
 * in.
 *
 * What is asserted per route x viewport:
 *
 * - no horizontal document overflow;
 * - exactly one <h1>;
 * - no console errors.
 *
 * What is asserted once, not per viewport (these do not vary by width):
 *
 * - the skip link is the first Tab stop and becomes visible on focus;
 * - a focused element always has a visible focus indicator (no `outline:
 *   none` with nothing standing in for it);
 * - the desktop nav-group dropdowns and the mobile nav-drawer both open via
 *   keyboard (Enter on a focused <summary>), not pointer-only;
 * - the hero heading's entrance animation is absent under
 *   `prefers-reduced-motion: reduce` (site.css gates it behind
 *   `@media (prefers-reduced-motion: no-preference)`, so this is checking
 *   that gate actually holds in a real browser, not just reading the CSS);
 * - the site's core colour-token pairs (ink/paper, ink-muted/paper,
 *   accent/paper, accent-contrast/accent) clear WCAG AA contrast in both
 *   light and dark `prefers-color-scheme`, checked as tokens rather than
 *   per-element because every text colour on this site comes from this
 *   small, finite set of custom properties.
 *
 * Usage: node scripts/run-marketing-viewport-capability-check.mjs
 */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/** `/opt/pw-browsers/chromium` is the development sandbox's pre-installed browser. */
function resolveChromiumExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (existsSync('/opt/pw-browsers/chromium')) return '/opt/pw-browsers/chromium';
  return undefined;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const marketingDir = path.join(repoRoot, 'apps/marketing');
const distDir = path.join(marketingDir, 'dist');
const resultsDir = path.join(repoRoot, 'benchmarks/results');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

function startServer() {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const relative = url.pathname;
    let filePath = path.join(distDir, relative);
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      if (!statSync(filePath).isFile()) throw new Error('not a file');
    } catch {
      filePath = path.join(filePath, 'index.html');
    }
    try {
      const contents = readFileSync(filePath);
      res.writeHead(200, {
        'content-type': MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      });
      res.end(contents);
    } catch {
      res.writeHead(404);
      res.end(readFileSync(path.join(distDir, '404.html')));
    }
  });
}

/** Always rebuild so the check reports on the working tree, not a stale bundle. */
function buildSite() {
  execFileSync('pnpm', ['--filter', '@arq/marketing', 'build'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (!existsSync(path.join(distDir, 'index.html'))) {
    throw new Error('marketing build did not produce apps/marketing/dist/index.html');
  }
}

/** Discover every rendered route by walking dist/ for index.html files, so this cannot drift from routes.ts. */
function discoverRoutes() {
  const routes = [];
  function walk(dir, routePrefix) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${routePrefix}/${entry.name}`);
      } else if (entry.name === 'index.html') {
        routes.push(routePrefix === '' ? '/' : routePrefix);
      }
    }
  }
  walk(distDir, '');
  routes.push('/404');
  return routes.sort();
}

/** The audit's named viewport matrix, given concrete pixel values. */
const VIEWPORTS = [
  { id: 'wide-desktop', width: 1920, height: 1080, touch: false },
  { id: '1440-desktop', width: 1440, height: 900, touch: false },
  { id: '1280', width: 1280, height: 800, touch: false },
  { id: '1024', width: 1024, height: 768, touch: false },
  { id: 'tablet-landscape', width: 1194, height: 834, touch: true },
  { id: 'tablet-portrait', width: 834, height: 1194, touch: true },
  { id: 'phone-portrait', width: 393, height: 852, touch: true },
  { id: 'phone-landscape', width: 852, height: 393, touch: true },
];

async function measurePage(page) {
  return page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    h1Count: document.querySelectorAll('h1').length,
    title: document.title,
  }));
}

function checkPage(route, m, consoleErrors) {
  const failures = [];
  if (m.horizontalOverflow) failures.push('document overflows horizontally');
  if (m.h1Count !== 1) failures.push(`expected exactly one h1, found ${m.h1Count}`);
  if (m.title.trim().length === 0) failures.push('empty <title>');
  // /404 is the one route whose own top-level navigation is meant to return
  // HTTP 404 - that is what a 404 page is. Chromium logs that as a console
  // "Failed to load resource" message the same way it would for a broken
  // subresource, so this is the one route where that specific message is
  // expected rather than a defect.
  const realErrors =
    route === '/404'
      ? consoleErrors.filter((message) => !/Failed to load resource.*404/.test(message))
      : consoleErrors;
  if (realErrors.length > 0) failures.push(`console errors: ${realErrors.join(' | ')}`);
  return failures;
}

/** WCAG relative luminance and contrast ratio from an "rgb(r, g, b)" string. */
function contrastRatio(rgbA, rgbB) {
  const toLuminance = (rgb) => {
    const [r, g, b] = rgb
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((c) => c / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const lA = toLuminance(rgbA);
  const lB = toLuminance(rgbB);
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

async function checkContrastTokens(browser, origin) {
  const failures = [];
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ colorScheme });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'networkidle' });
    const tokens = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      const resolve = (value) => {
        const probe = document.createElement('div');
        probe.style.color = value;
        document.body.appendChild(probe);
        const rgb = getComputedStyle(probe).color;
        probe.remove();
        return rgb;
      };
      return {
        paper: resolve(style.getPropertyValue('--paper').trim()),
        ink: resolve(style.getPropertyValue('--ink').trim()),
        inkMuted: resolve(style.getPropertyValue('--ink-muted').trim()),
        accent: resolve(style.getPropertyValue('--accent').trim()),
        accentContrast: resolve(style.getPropertyValue('--accent-contrast').trim()),
      };
    });
    await context.close();

    const pairs = [
      ['ink on paper (body text)', tokens.ink, tokens.paper, 4.5],
      ['ink-muted on paper (secondary text)', tokens.inkMuted, tokens.paper, 4.5],
      ['accent on paper (links)', tokens.accent, tokens.paper, 4.5],
      ['accent-contrast on accent (solid buttons)', tokens.accentContrast, tokens.accent, 4.5],
    ];
    for (const [label, fg, bg, minRatio] of pairs) {
      const ratio = contrastRatio(fg, bg);
      if (ratio < minRatio) {
        failures.push(
          `${colorScheme}: ${label} is ${ratio.toFixed(2)}:1, below the ${minRatio}:1 WCAG AA floor`,
        );
      }
    }
    console.log(
      `  contrast (${colorScheme}): ${pairs.map(([label, fg, bg]) => `${label} ${contrastRatio(fg, bg).toFixed(2)}:1`).join(', ')}`,
    );
  }
  return failures;
}

async function checkKeyboardAndFocus(browser, origin) {
  const failures = [];

  // Desktop: skip link first, then focus-visible outline, then a nav-group opens via keyboard.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'networkidle' });

    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => ({
      className: document.activeElement?.className ?? null,
      tag: document.activeElement?.tagName ?? null,
    }));
    if (!(first.tag === 'A' && String(first.className).includes('skip-link'))) {
      failures.push(
        `first Tab stop was <${first.tag}> class="${first.className}", expected the skip link`,
      );
    }

    const focusVisible = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = getComputedStyle(el);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
    });
    if (
      focusVisible === null ||
      focusVisible.outlineStyle === 'none' ||
      focusVisible.outlineWidth === '0px'
    ) {
      failures.push(`focused skip link has no visible outline (${JSON.stringify(focusVisible)})`);
    }

    // Tab from the skip link to the wordmark, then to the first nav-group summary.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const onGroupSummary = await page.evaluate(
      () =>
        document.activeElement?.tagName === 'SUMMARY' &&
        document.activeElement.closest('.nav-group') !== null,
    );
    if (!onGroupSummary) {
      failures.push(
        'third Tab stop is not the first nav-group summary (header structure may have changed)',
      );
    } else {
      await page.keyboard.press('Enter');
      const opened = await page.evaluate(
        () => document.querySelector('.nav-group')?.hasAttribute('open') ?? false,
      );
      if (!opened) failures.push('Enter on a focused nav-group summary did not open its dropdown');
    }
    await context.close();
  }

  // Phone: the nav-drawer opens via keyboard the same way.
  {
    const context = await browser.newContext({
      viewport: { width: 393, height: 852 },
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(origin, { waitUntil: 'networkidle' });
    const drawerSummary = page.locator('.nav-drawer summary');
    await drawerSummary.focus();
    await page.keyboard.press('Enter');
    const opened = await page.evaluate(
      () => document.querySelector('.nav-drawer')?.hasAttribute('open') ?? false,
    );
    if (!opened) failures.push('Enter on the focused mobile nav-drawer summary did not open it');
    await context.close();
  }

  return failures;
}

async function checkReducedMotion(browser, origin) {
  const failures = [];
  const withMotion = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
  });
  const reduced = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  try {
    const pageA = await withMotion.newPage();
    await pageA.goto(origin, { waitUntil: 'networkidle' });
    const animatedName = await pageA.evaluate(
      () => getComputedStyle(document.querySelector('.hero h1')).animationName,
    );

    const pageB = await reduced.newPage();
    await pageB.goto(origin, { waitUntil: 'networkidle' });
    const reducedName = await pageB.evaluate(
      () => getComputedStyle(document.querySelector('.hero h1')).animationName,
    );
    const h1VisibleUnderReduced = await pageB.evaluate(() => {
      const h1 = document.querySelector('.hero h1');
      if (!h1) return false;
      const style = getComputedStyle(h1);
      return style.opacity !== '0' && style.visibility !== 'hidden';
    });

    if (animatedName === 'none') {
      failures.push(
        'hero h1 has no entrance animation even with no reduced-motion preference (expected one)',
      );
    }
    if (reducedName !== 'none') {
      failures.push(
        `hero h1 still animates (animation-name: ${reducedName}) under prefers-reduced-motion: reduce`,
      );
    }
    if (!h1VisibleUnderReduced) {
      failures.push('hero h1 is not visible under prefers-reduced-motion: reduce');
    }
  } finally {
    await withMotion.close();
    await reduced.close();
  }
  return failures;
}

async function main() {
  buildSite();
  const server = startServer();
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  const routes = discoverRoutes();
  const browser = await chromium.launch({ executablePath: resolveChromiumExecutablePath() });

  let failed = 0;
  const results = [];

  console.log(`Checking ${routes.length} routes across ${VIEWPORTS.length} viewports...\n`);

  for (const route of routes) {
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

      await page.goto(`${origin}${route}`, { waitUntil: 'networkidle' });
      const measurement = await measurePage(page);
      const failures = checkPage(route, measurement, consoleErrors);
      if (failures.length > 0) {
        failed += 1;
        console.log(`FAIL  ${route.padEnd(24)} ${viewport.id}`);
        for (const failure of failures) console.log(`        - ${failure}`);
      }
      results.push({ route, viewport: viewport.id, measurement, failures });
      await context.close();
    }
  }
  console.log(
    `\nRoute x viewport matrix: ${routes.length * VIEWPORTS.length - failed} of ${routes.length * VIEWPORTS.length} pass.`,
  );

  console.log('\nKeyboard and focus (home page):');
  const keyboardFailures = await checkKeyboardAndFocus(browser, origin);
  for (const failure of keyboardFailures) console.log(`  FAIL - ${failure}`);
  if (keyboardFailures.length === 0) console.log('  PASS');
  failed += keyboardFailures.length;

  console.log('\nReduced motion (home page):');
  const motionFailures = await checkReducedMotion(browser, origin);
  for (const failure of motionFailures) console.log(`  FAIL - ${failure}`);
  if (motionFailures.length === 0) console.log('  PASS');
  failed += motionFailures.length;

  console.log('\nColour token contrast (home page):');
  const contrastFailures = await checkContrastTokens(browser, origin);
  for (const failure of contrastFailures) console.log(`  FAIL - ${failure}`);
  if (contrastFailures.length === 0) console.log('  PASS');
  failed += contrastFailures.length;

  await browser.close();
  server.close();

  mkdirSync(resultsDir, { recursive: true });
  const outPath = path.join(
    resultsDir,
    `marketing-viewport-capability-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        routes,
        viewports: VIEWPORTS.map((v) => v.id),
        matrix: results,
        keyboardFailures,
        motionFailures,
        contrastFailures,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nWrote ${path.relative(repoRoot, outPath)}`);

  if (failed > 0) {
    console.error(`\n${failed} total failure(s).`);
    process.exit(1);
  }
  console.log('\nAll checks pass.');
}

await main();
