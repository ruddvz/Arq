#!/usr/bin/env node
/**
 * Pins scripts/check-web-bundle-budget.mjs, in the same standalone shape as
 * scripts/check-notice-attribution-test.mjs and scripts/check-secrets-test.mjs.
 *
 * The failure this guard exists to prevent is a split coming undone unnoticed.
 * A guard for that which stopped detecting would reproduce exactly that failure
 * while reporting success, so both halves have to prove they fire: the byte
 * budget and the marker check, independently, because a change can break either
 * one on its own.
 */
import { createHash } from 'node:crypto';
import {
  BUDGET,
  DEFERRED_LIBRARIES,
  evaluateBundle,
  findEntryScript,
} from './check-web-bundle-budget.mjs';

let failures = 0;
function check(description, condition) {
  if (condition) {
    process.stdout.write(`PASS ${description}\n`);
  } else {
    failures += 1;
    process.stderr.write(`FAIL ${description}\n`);
  }
}

/**
 * Deterministic bytes that gzip cannot shrink, so "over budget" in a test means
 * over budget. A linear congruential generator is the obvious way to write this
 * and the wrong one: its low byte has a short period, gzip finds the pattern,
 * and the oversized fixture compresses back under the budget - which is how
 * this helper failed first time round. Chained SHA-256 has no such structure
 * and is still reproducible.
 */
function incompressible(bytes) {
  const chunks = [];
  let total = 0;
  let block = createHash('sha256').update('arq-bundle-budget').digest();
  while (total < bytes) {
    chunks.push(block);
    total += block.length;
    block = createHash('sha256').update(block).digest();
  }
  return Buffer.concat(chunks, bytes);
}

const EMPTY_CSS = Buffer.alloc(0);
const SMALL_ENTRY = Buffer.from('const a = 1; export default a;');

check(
  'a small clean entry passes',
  evaluateBundle({ entryJs: SMALL_ENTRY, cssBytes: EMPTY_CSS, entrySource: SMALL_ENTRY.toString() })
    .findings.length === 0,
);

const oversized = incompressible(BUDGET.startupGzip + 64 * 1024);
check(
  'an entry over the gzipped budget is caught',
  evaluateBundle({
    entryJs: oversized,
    cssBytes: EMPTY_CSS,
    entrySource: 'clean',
  }).findings.some((f) => f.includes('over the') && f.includes('budget')),
);

check(
  'CSS counts toward the start-up budget, not just JavaScript',
  evaluateBundle({
    entryJs: SMALL_ENTRY,
    cssBytes: incompressible(BUDGET.startupGzip + 64 * 1024),
    entrySource: SMALL_ENTRY.toString(),
  }).findings.some((f) => f.includes('budget')),
);

for (const { library, marker } of DEFERRED_LIBRARIES) {
  check(
    `${library} inlined into the entry chunk is caught`,
    evaluateBundle({
      entryJs: SMALL_ENTRY,
      cssBytes: EMPTY_CSS,
      entrySource: `some code ${marker} more code`,
    }).findings.some((f) => f.includes(library)),
  );
}

check(
  'a deferred library absent from the entry chunk raises nothing',
  evaluateBundle({
    entryJs: SMALL_ENTRY,
    cssBytes: EMPTY_CSS,
    entrySource: 'no markers here at all',
  }).findings.length === 0,
);

// A budget met while a library is inlined is the combination a size-only guard
// would wave through, and the reason the marker check exists at all.
check(
  'a small entry that inlines a deferred library still fails',
  evaluateBundle({
    entryJs: SMALL_ENTRY,
    cssBytes: EMPTY_CSS,
    entrySource: `tiny but ${DEFERRED_LIBRARIES[0].marker}`,
  }).findings.length === 1,
);

check(
  'the entry script is read from index.html rather than guessed',
  findEntryScript('<script type="module" crossorigin src="/assets/index-ABC123.js"></script>') ===
    'index-ABC123.js',
);

check(
  'an index.html with no module script is reported rather than assumed',
  findEntryScript('<html><body>no script</body></html>') === null,
);

if (failures > 0) {
  process.stderr.write(`\n${failures} bundle budget guard case(s) failed.\n`);
  process.exit(1);
}
process.stdout.write('\nBundle budget guard test passed.\n');
