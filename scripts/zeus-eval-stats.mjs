#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const path = join(process.cwd(), '.zeus', 'eval-log.jsonl');
if (!existsSync(path)) {
  console.log('No Zeus evaluation log exists.');
  process.exit(0);
}
const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
const entries = [];
let malformed = 0;
for (const line of lines) {
  try {
    entries.push(JSON.parse(line));
  } catch {
    malformed += 1;
  }
}
if (!entries.length) {
  console.log(`No valid Zeus entries${malformed ? `; ${malformed} malformed` : ''}.`);
  process.exit(malformed ? 1 : 0);
}
const by = (field) =>
  entries.reduce((acc, item) => {
    const key = item[field] ?? 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
console.log(`Zeus evaluations: ${entries.length}${malformed ? ` (${malformed} malformed)` : ''}`);
console.log(
  `Outcomes: ${Object.entries(by('outcome'))
    .map(([k, v]) => `${k}=${v}`)
    .join('  ')}`,
);
console.log(
  `Lanes: ${Object.entries(by('lane'))
    .map(([k, v]) => `${k}=${v}`)
    .join('  ')}`,
);
if (malformed) process.exitCode = 1;
