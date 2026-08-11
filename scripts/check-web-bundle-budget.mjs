#!/usr/bin/env node
/**
 * A start-up bundle budget for apps/web, and a structural check that the code
 * splits it depends on are still in place.
 *
 * This exists because the split was made once and then silently came undone.
 * The 3D surface was deferred in 4c31107, taking the entry chunk from 1,136 kB
 * raw / 326 kB gzipped down to 614 kB / 193 kB. By the time of this check the
 * entry chunk had reached 1,762 kB / 743 kB - larger than the figure that
 * prompted the original work, and nearly four times the gzipped size the split
 * had achieved. Nothing was watching, so nothing objected.
 *
 * A byte budget alone would be a weak guard. A budget can be met while the
 * split it depends on quietly reverses, if something else shrank in the same
 * change; and when it does fail, "the bundle is too big" does not tell the next
 * person which boundary broke. So this checks two different things:
 *
 *   1. The entry chunk, plus the CSS the page blocks on, stays inside a stated
 *      gzipped budget. That is the number a user on a slow connection pays
 *      before anything is interactive.
 *   2. Libraries that are supposed to be deferred are genuinely absent from the
 *      entry chunk, asserted by markers from the libraries themselves rather
 *      than by chunk filename. A filename check passes as soon as a chunk with
 *      the right name exists, even if the same code is also inlined into the
 *      entry; a marker check cannot be satisfied that way.
 *
 * Markers are strings the library emits into its own output, chosen to be
 * distinctive enough not to appear by accident and stable enough not to vanish
 * on a patch release. If a library legitimately stops emitting one, this check
 * fails loudly and the marker gets updated - which is the right failure, since
 * the alternative is a guard that quietly stops guarding.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'apps/web/dist');

/**
 * Gzipped bytes, because that is what crosses the network. Headroom is
 * deliberate but finite: enough that ordinary feature work does not trip it,
 * little enough that re-inlining a deferred library does.
 */
export const BUDGET = {
  /** Entry JavaScript plus render-blocking CSS, gzipped. */
  startupGzip: 300 * 1024,
};

/**
 * Each marker names one library that must not be in the entry chunk, and the
 * boundary that keeps it out.
 */
export const DEFERRED_LIBRARIES = [
  {
    library: 'pdf-lib (sheet export)',
    // A PDF content-stream operator name pdf-lib emits in its operator table.
    marker: 'BeginCompatibilitySection',
    boundary: "App.tsx imports './sheets/sheet-export' dynamically, inside the export handler",
  },
  {
    library: 'three.js (3D surface)',
    // three.js stamps its own revision constant into its build.
    marker: 'WebGLRenderer',
    boundary: "App.tsx loads './ModelCanvas' through React.lazy, on first 3D tab open",
  },
];

/** The entry is whatever index.html actually loads, not whichever file looks biggest. */
export function findEntryScript(indexHtml) {
  const match = indexHtml.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
  return match ? path.basename(match[1]) : null;
}

export function evaluateBundle({ entryJs, cssBytes, entrySource }) {
  const findings = [];
  const startupGzip = gzipSync(Buffer.concat([entryJs, cssBytes])).length;

  if (startupGzip > BUDGET.startupGzip) {
    findings.push(
      `start-up payload is ${(startupGzip / 1024).toFixed(1)}KB gzipped, over the ` +
        `${BUDGET.startupGzip / 1024}KB budget. Defer something, or raise the budget ` +
        `deliberately and say why in the same change.`,
    );
  }

  for (const { library, marker, boundary } of DEFERRED_LIBRARIES) {
    if (entrySource.includes(marker)) {
      findings.push(
        `${library} is in the entry chunk (found "${marker}"), so every reader downloads it ` +
          `before the first paint. The boundary that should keep it out: ${boundary}.`,
      );
    }
  }

  return { findings, startupGzip };
}

function main() {
  const indexPath = path.join(distDir, 'index.html');
  if (!existsSync(indexPath)) {
    process.stderr.write(
      `Cannot verify the bundle budget: ${path.relative(repoRoot, indexPath)} is absent. ` +
        'Run `pnpm build` first. Refusing to report a budget as met against a build that ' +
        'was never produced.\n',
    );
    process.exit(1);
  }

  const entryName = findEntryScript(readFileSync(indexPath, 'utf8'));
  if (entryName === null) {
    process.stderr.write('Cannot verify the bundle budget: index.html loads no module script.\n');
    process.exit(1);
  }

  const assetsDir = path.join(distDir, 'assets');
  const entryPath = path.join(assetsDir, entryName);
  const entryJs = readFileSync(entryPath);
  const cssFiles = readdirSync(assetsDir).filter((name) => name.endsWith('.css'));
  const cssBytes = Buffer.concat(cssFiles.map((name) => readFileSync(path.join(assetsDir, name))));

  const { findings, startupGzip } = evaluateBundle({
    entryJs,
    cssBytes,
    entrySource: entryJs.toString('utf8'),
  });

  if (findings.length > 0) {
    for (const finding of findings) process.stderr.write(`FAIL ${finding}\n`);
    process.exit(1);
  }

  process.stdout.write(
    `Start-up payload ${(startupGzip / 1024).toFixed(1)}KB gzipped ` +
      `(${entryName} + ${cssFiles.length} stylesheet(s)), within the ` +
      `${BUDGET.startupGzip / 1024}KB budget. ` +
      `${DEFERRED_LIBRARIES.length} deferred librar(y/ies) confirmed absent from the entry chunk.\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
