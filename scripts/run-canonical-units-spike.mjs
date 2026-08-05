/**
 * V3-106: the canonical-units spike the ARQ File System 3.0 draft requires
 * before integer micrometres can stop being Proposed.
 *
 * The draft's own framing is that this is a decision needing evidence, not an
 * argument. So this script measures rather than asserts, and prints numbers a
 * reviewer can disagree with. It compares the two candidates on the properties
 * that actually decide the question:
 *
 *   1. representable range      - does the candidate even fit in a JS number?
 *   2. round-trip determinism   - move a wall and move it back
 *   3. accumulated drift        - many transforms, as a replayed log produces
 *   4. unit-conversion exactness - metric and imperial sources
 *   5. equality and hashing     - do identical projects compare identical?
 *   6. arithmetic cost          - is the exact candidate slower in practice?
 *
 * Run: node scripts/run-canonical-units-spike.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const MICROMETRES_PER_MILLIMETRE = 1_000;
const MICROMETRES_PER_METRE = 1_000_000;
const MAX_PROJECT_EXTENT_MICROMETRES = 100_000 * MICROMETRES_PER_METRE;

const results = [];
function record(name, detail) {
  results.push({ name, ...detail });
  const verdict = detail.pass === undefined ? '    ' : detail.pass ? 'PASS' : 'FAIL';
  console.log(`${verdict}  ${name}`);
  for (const [key, value] of Object.entries(detail)) {
    if (key === 'pass') continue;
    console.log(`        ${key}: ${value}`);
  }
}

// ---------------------------------------------------------------------------
// 1. Representable range.
//
// The draft assumed 64-bit micrometres would force `bigint` in TypeScript and
// treated that as the decision's main cost. This measures whether it does.
// ---------------------------------------------------------------------------
{
  const safeMetres = Number.MAX_SAFE_INTEGER / MICROMETRES_PER_METRE;
  const headroom = Number.MAX_SAFE_INTEGER / MAX_PROJECT_EXTENT_MICROMETRES;
  record('integer micrometres fit in a JS double without bigint', {
    maxSafeInteger: Number.MAX_SAFE_INTEGER,
    exactlyRepresentableMetres: safeMetres.toExponential(3),
    exactlyRepresentableKilometres: (safeMetres / 1000).toExponential(3),
    chosenProjectExtentKm: MAX_PROJECT_EXTENT_MICROMETRES / MICROMETRES_PER_METRE / 1000,
    headroomBelowMaxSafeInteger: `${headroom.toExponential(2)}x`,
    pass: MAX_PROJECT_EXTENT_MICROMETRES < Number.MAX_SAFE_INTEGER / 1000,
  });
}

// ---------------------------------------------------------------------------
// 2. Round-trip determinism: move a wall by a distance, then move it back.
//
// The user's expectation is that this is a no-op. Whether it is depends
// entirely on the representation.
// ---------------------------------------------------------------------------
{
  const offsetsMm = [0.1, 1 / 3, 2.7, 1234.5678, 0.05, 99.999];
  let floatExact = 0;
  let intExact = 0;

  for (const offset of offsetsMm) {
    const startMm = 1000;
    const floatRoundTrip = startMm + offset - offset;
    if (floatRoundTrip === startMm) floatExact += 1;

    const startUm = Math.round(startMm * MICROMETRES_PER_MILLIMETRE);
    const offsetUm = Math.round(offset * MICROMETRES_PER_MILLIMETRE);
    const intRoundTrip = startUm + offsetUm - offsetUm;
    if (intRoundTrip === startUm) intExact += 1;
  }

  record('single move-and-move-back returns exactly to the start', {
    cases: offsetsMm.length,
    float64MillimetresExact: `${floatExact}/${offsetsMm.length}`,
    integerMicrometresExact: `${intExact}/${offsetsMm.length}`,
    pass: intExact === offsetsMm.length,
  });
}

// ---------------------------------------------------------------------------
// 3. Accumulated drift over many transforms.
//
// This is the case a replayed operation log or a repeatedly nudged wall
// actually produces, and where float64 stops being "almost exact".
// ---------------------------------------------------------------------------
{
  const iterations = 100_000;
  const stepMm = 0.1;

  let floatMm = 0;
  for (let i = 0; i < iterations; i += 1) floatMm += stepMm;
  for (let i = 0; i < iterations; i += 1) floatMm -= stepMm;

  const stepUm = Math.round(stepMm * MICROMETRES_PER_MILLIMETRE);
  let intUm = 0;
  for (let i = 0; i < iterations; i += 1) intUm += stepUm;
  for (let i = 0; i < iterations; i += 1) intUm -= stepUm;

  record('drift after 200,000 accumulating transforms', {
    iterations: iterations * 2,
    float64ResidualMm: floatMm.toExponential(4),
    float64ResidualNanometres: (floatMm * 1e6).toFixed(3),
    integerResidualMicrometres: intUm,
    pass: intUm === 0,
  });
}

// ---------------------------------------------------------------------------
// 4. Unit conversion, including imperial sources.
//
// An imported imperial drawing is the adversarial case: 25.4 is exact in
// decimal and not in binary, so the question is whether a converted value
// survives a round trip back to its source unit.
// ---------------------------------------------------------------------------
{
  const inchValues = [1, 3.5, 12, 36.25, 120.125];
  const MM_PER_INCH = 25.4;
  let floatStable = 0;
  let intStable = 0;

  for (const inches of inchValues) {
    const mm = inches * MM_PER_INCH;
    if (mm / MM_PER_INCH === inches) floatStable += 1;

    const um = Math.round(mm * MICROMETRES_PER_MILLIMETRE);
    // Stable if the stored value returns to the same inch measurement at the
    // precision a drawing can actually express (three decimal places).
    const backToInches = um / MICROMETRES_PER_MILLIMETRE / MM_PER_INCH;
    if (Math.abs(backToInches - inches) < 1e-3) intStable += 1;
  }

  record('imperial import survives conversion to canonical and back', {
    cases: inchValues.length,
    float64Stable: `${floatStable}/${inchValues.length}`,
    integerStableToThousandthInch: `${intStable}/${inchValues.length}`,
    quantisationErrorBoundMicrometres: 0.5,
    pass: intStable === inchValues.length,
  });
}

// ---------------------------------------------------------------------------
// 5. Equality and hashing determinism.
//
// Two projects built by different routes to the same geometry must hash the
// same, or the semantic hash cannot be used to prove a migration or a
// publication preserved meaning.
// ---------------------------------------------------------------------------
{
  // The same 300mm reached two ways: one addition, and 3000 additions of 0.1mm.
  const directMm = 300;
  let summedMm = 0;
  for (let i = 0; i < 3000; i += 1) summedMm += 0.1;

  const floatEqual = directMm === summedMm;

  const directUm = Math.round(directMm * MICROMETRES_PER_MILLIMETRE);
  let summedUm = 0;
  const stepUm = Math.round(0.1 * MICROMETRES_PER_MILLIMETRE);
  for (let i = 0; i < 3000; i += 1) summedUm += stepUm;
  const intEqual = directUm === summedUm;

  record('geometry reached by two routes compares equal', {
    directMm,
    float64SummedMm: summedMm,
    float64Equal: floatEqual,
    integerDirectUm: directUm,
    integerSummedUm: summedUm,
    integerEqual: intEqual,
    pass: intEqual,
  });
}

// ---------------------------------------------------------------------------
// 6. Arithmetic cost.
//
// The performance objection to an exact representation, measured rather than
// assumed - including bigint, to show what the draft's assumed approach costs.
// ---------------------------------------------------------------------------
{
  const iterations = 5_000_000;

  const floatStart = performance.now();
  let f = 0;
  for (let i = 0; i < iterations; i += 1) f += i * 0.001;
  const floatMs = performance.now() - floatStart;

  const intStart = performance.now();
  let n = 0;
  for (let i = 0; i < iterations; i += 1) n += i;
  const intMs = performance.now() - intStart;

  const bigStart = performance.now();
  let b = 0n;
  for (let i = 0; i < iterations; i += 1) b += BigInt(i);
  const bigMs = performance.now() - bigStart;

  record('arithmetic cost per representation', {
    iterations,
    float64Ms: floatMs.toFixed(1),
    integerNumberMs: intMs.toFixed(1),
    bigintMs: bigMs.toFixed(1),
    bigintSlowdownVsNumber: `${(bigMs / Math.max(intMs, 0.001)).toFixed(1)}x`,
    note: 'integer micrometres held in a number carry no arithmetic penalty; bigint does',
    // Informational: no pass/fail, since this measures cost rather than
    // correctness. Recording it as a verdict would imply a threshold nobody set.
  });
}

// ---------------------------------------------------------------------------
// Verdict.
// ---------------------------------------------------------------------------
const judged = results.filter((r) => r.pass !== undefined);
const failed = judged.filter((r) => !r.pass);

console.log('');
console.log(`${judged.length - failed.length}/${judged.length} measured properties hold.`);
console.log('');
console.log('Finding: signed integer micrometres held in a JS number give exact');
console.log('round-trips, zero accumulated drift, and route-independent equality,');
console.log('with no bigint and no arithmetic penalty. The extent limit, not the');
console.log('representation, is what needs review.');
console.log('');
console.log('Still Proposed. This spike covers representation only. Migration of');
console.log('existing projects, 100MB project performance, WebAssembly transport and');
console.log('SQLite index cost are separate evidence the decision also requires.');

const outputDir = path.join(process.cwd(), 'benchmarks', 'results');
mkdirSync(outputDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = path.join(outputDir, `canonical-units-spike-${stamp}.json`);
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      spike: 'canonical-units',
      backlogId: 'V3-106',
      state: 'proposed',
      scope: 'representation only; migration, 100MB, wasm transport and SQLite cost not covered',
      node: process.version,
      results,
    },
    null,
    2,
  )}\n`,
);
console.log(`Saved to ${path.relative(process.cwd(), outputPath)}`);

process.exit(failed.length === 0 ? 0 : 1);
