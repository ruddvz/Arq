#!/usr/bin/env node
/**
 * ARQ-171: ipad: test Pencil web input.
 *
 * Drives packages/input-system/benchmarks/pencil-web-input/pencil-pointer-capability.html
 * in real headless Chromium (Playwright) - real captured PointerEvent
 * fields from an actual browser engine's own implementation, not a
 * hand-typed guess at what the spec says. No physical iPad or Apple
 * Pencil hardware exists in this sandboxed environment; see
 * docs/research/PENCIL-WEB-INPUT.md for that caveat spelled out in full.
 *
 * Usage: node scripts/run-pencil-pointer-capability-check.mjs
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(
  repoRoot,
  'packages/input-system/benchmarks/pencil-web-input/pencil-pointer-capability.html',
);

async function main() {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`);
    await page.waitForFunction(() => window.__ARQ_PENCIL_CAPABILITY_RESULT__ !== undefined, {
      timeout: 10_000,
    });
    const result = await page.evaluate(() => window.__ARQ_PENCIL_CAPABILITY_RESULT__);
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
      `pencil-pointer-capability-${report.timestamp.replace(/[:.]/g, '-')}.json`,
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
