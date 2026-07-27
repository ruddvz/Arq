#!/usr/bin/env node
/**
 * Given changed repo paths on argv/stdin, print language domains likely affected.
 * Advisory only. Freshness and hard audits remain gates.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  join(PACKAGE_ROOT, '02-canonical/change-impact-map.json'),
  join(process.cwd(), 'docs/product/voice/change-impact-map.json'),
];
const mapPath = candidates.find(existsSync);
if (!mapPath) {
  console.error('No change-impact-map.json found.');
  process.exit(1);
}
const map = JSON.parse(readFileSync(mapPath, 'utf8'));

let paths = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
if (!paths.length) {
  try {
    paths = readFileSync('/dev/stdin', 'utf8')
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
  } catch {}
}
if (!paths.length) {
  console.log('Pass changed repo paths as arguments or newline-delimited stdin.');
  process.exit(0);
}
let matched = 0;
for (const domain of map.domains) {
  const matches = paths.filter((path) =>
    domain.triggers.some((trigger) => path.includes(trigger.replace('*', ''))),
  );
  if (!matches.length) continue;
  matched += 1;
  console.log(`\n${domain.id}`);
  console.log(`  changed: ${matches.join(', ')}`);
  console.log(`  update: ${domain.update.join(', ')}`);
  console.log(`  gate: ${domain.gate}`);
}
if (!matched) console.log('No configured language impact domain matched these paths.');
