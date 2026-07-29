#!/usr/bin/env node
// Zeus 5: regression cases for the deterministic tool guard.
//
// The guard has two failure modes and both are real. Blocking too little lets a
// destructive or secret-reading call through. Blocking too much makes ordinary
// work impossible, which is how guards get disabled. Every case below pins one
// side of that line.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));
const casesPath = join(packageRoot, 'quality', 'fixtures', 'zeus-guard-cases.json');
const hook = join(packageRoot, '.claude', 'hooks', 'pre-tool-guard.cjs');

const cases = JSON.parse(readFileSync(casesPath, 'utf8'));
let failed = 0;

for (const c of cases) {
  const r = spawnSync(process.execPath, [hook], {
    input: JSON.stringify(c.payload),
    encoding: 'utf8',
    cwd: packageRoot,
  });
  const ok = r.status === c.expect;
  if (!ok) {
    failed++;
    console.error(`FAIL expected exit ${c.expect}, got ${r.status}: ${c.name}`);
    if (r.stderr) console.error(`     ${r.stderr.trim()}`);
  }
}

if (failed) {
  console.error(`\nZeus guard test failed: ${failed} of ${cases.length} cases.`);
  process.exit(1);
}
console.log(`Zeus guard test passed (${cases.length} cases).`);
