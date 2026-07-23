#!/usr/bin/env node
/**
 * ARQ-204/200/224/225: verifies the compiled WASM module produces the same results
 * as rust/arq-core's own native `cargo test` cases - the actual point of ADR-0020's
 * "the same model operation must produce the same semantic result and model hash on
 * all supported targets," checked directly rather than assumed from the fact that
 * both targets compile from the same source.
 *
 * Requires rust/arq-core/pkg/ to exist (node scripts/build-arq-core-wasm.mjs).
 *
 * Usage: node scripts/verify-arq-core-wasm-parity.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const pkgDir = path.join(repoRoot, 'rust/arq-core/pkg');

const CASES = [];
function check(name, actual, expected) {
  const pass =
    JSON.stringify(actual, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ) ===
    JSON.stringify(expected, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
  CASES.push({ name, pass, actual: String(actual), expected: String(expected) });
}

async function main() {
  const mod = await import(path.join(pkgDir, 'arq_core.js'));
  const bytes = readFileSync(path.join(pkgDir, 'arq_core_bg.wasm'));
  await mod.default({ module_or_path: bytes });

  // Mirrors rust/arq-core/src/units.rs's own test cases exactly.
  check(
    'mmToCanonicalMicrometres(4000) === 4_000_000n',
    mod.mmToCanonicalMicrometres(4000),
    4_000_000n,
  );
  check(
    'mmToCanonicalMicrometres(123.456) === 123_456n',
    mod.mmToCanonicalMicrometres(123.456),
    123_456n,
  );
  check(
    'mmToCanonicalMicrometres(NaN) === undefined',
    mod.mmToCanonicalMicrometres(NaN),
    undefined,
  );
  check(
    'mmToCanonicalMicrometres(Infinity) === undefined',
    mod.mmToCanonicalMicrometres(Infinity),
    undefined,
  );
  check(
    'canonicalMicrometresToMm(4_000_000n) === 4000',
    mod.canonicalMicrometresToMm(4_000_000n),
    4000,
  );
  check(
    'canonicalMicrometresToMm(-4_000_000n) === -4000',
    mod.canonicalMicrometresToMm(-4_000_000n),
    -4000,
  );

  // Mirrors rust/arq-core/src/ordering.rs's own test cases exactly.
  check(
    'canonicalSortIds byte-wise, not numeric',
    mod.canonicalSortIds(['wall-2', 'wall-10', 'wall-1']),
    ['wall-1', 'wall-10', 'wall-2'],
  );
  check('canonicalSortIds([]) === []', mod.canonicalSortIds([]), []);

  // Mirrors rust/arq-core/src/hashing.rs's own test cases exactly.
  check(
    'semanticHash(empty) matches the well-known SHA-256 of empty input',
    mod.semanticHash(new Uint8Array()),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
  check(
    'semanticHash is deterministic for identical input',
    mod.semanticHash(new TextEncoder().encode('canonical-bytes')),
    mod.semanticHash(new TextEncoder().encode('canonical-bytes')),
  );

  const allPassed = CASES.every((c) => c.pass);
  const report = {
    timestamp: new Date().toISOString(),
    environment:
      'Node.js WASM (wasm-bindgen --target web), compared against rust/arq-core native cargo test expectations',
    allPassed,
    cases: CASES,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!allPassed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
