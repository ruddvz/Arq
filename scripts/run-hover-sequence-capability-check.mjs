#!/usr/bin/env node
/**
 * ARQ-172: ipad: prototype native hover.
 *
 * Drives packages/input-system/benchmarks/pencil-web-input/hover-sequence-capability.html
 * in real headless Chromium (Playwright) - confirms a real browser
 * engine delivers a full, correctly-ordered hover event sequence
 * (over -> move -> move -> out, never a down) for pointerType 'pen',
 * 'touch' and 'mouse'. No physical iPad or Apple Pencil hardware exists
 * in this sandboxed environment; see docs/research/PENCIL-WEB-INPUT.md.
 *
 * Usage: node scripts/run-hover-sequence-capability-check.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
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
const htmlPath = path.join(
  repoRoot,
  'packages/input-system/benchmarks/pencil-web-input/hover-sequence-capability.html',
);

async function main() {
  const browser = await chromium.launch({
    executablePath: resolveChromiumExecutablePath(),
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.__ARQ_HOVER_SEQUENCE_RESULT__ !== undefined, {
      timeout: 10_000,
    });
    const result = await page.evaluate(() => window.__ARQ_HOVER_SEQUENCE_RESULT__);
    const version = await browser.version();

    const report = {
      timestamp: new Date().toISOString(),
      environment: `headless Chromium ${version}, sandboxed container - real browser engine, not a physical iPad or Apple Pencil (see docs/research/PENCIL-WEB-INPUT.md)`,
      ...result,
    };

    console.log(JSON.stringify(report, null, 2));

    const outDir = path.join(repoRoot, 'benchmarks/results');
    mkdirSync(outDir, { recursive: true });
    const outPath = path.join(
      outDir,
      `hover-sequence-capability-${report.timestamp.replace(/[:.]/g, '-')}.json`,
    );
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`\nSaved to ${path.relative(repoRoot, outPath)}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
