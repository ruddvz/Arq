#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const languageRoot = resolve(
  args.includes('--language-root')
    ? args[args.indexOf('--language-root') + 1]
    : join(ROOT, 'docs/product/voice'),
);
const locate = (name) => {
  const path = [join(languageRoot, `02-canonical/${name}`), join(languageRoot, name)].find(
    existsSync,
  );
  if (!path) throw new Error(`Missing ${name}`);
  return path;
};
const claims = JSON.parse(readFileSync(locate('claim-registry.json'), 'utf8'));
const conflicts = JSON.parse(readFileSync(locate('conflict-registry.json'), 'utf8'));
const bindings = JSON.parse(readFileSync(locate('claim-binding-registry.json'), 'utf8'));
const sources = JSON.parse(readFileSync(locate('source-registry.json'), 'utf8'));
const claimById = new Map(claims.claims.map((x) => [x.id, x]));
const sourceIds = new Set(sources.sources.map((x) => x.id));
const activeStatuses = new Set(conflicts.activeStatuses ?? []);
let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};
const activeClaims = new Set();
for (const conflict of conflicts.conflicts ?? []) {
  for (const sourceId of conflict.sourceIds ?? [])
    if (!sourceIds.has(sourceId)) fail(`${conflict.id} uses unknown source ${sourceId}`);
  for (const claimId of conflict.affectedClaimIds ?? []) {
    const claim = claimById.get(claimId);
    if (!claim) {
      fail(`${conflict.id} affects missing claim ${claimId}`);
      continue;
    }
    if (activeStatuses.has(conflict.status)) {
      activeClaims.add(claimId);
      if (claim.state === 'CURRENT')
        fail(`${conflict.id} leaves affected claim ${claimId} as CURRENT`);
      if (!(conflict.blockedSurfaces ?? []).length) fail(`${conflict.id} needs blocked surfaces`);
      if (!(conflict.resolution?.requires ?? []).length)
        fail(`${conflict.id} needs resolution criteria`);
    }
  }
}
for (const claim of claims.claims.filter((x) => x.state === 'CONFLICTED')) {
  if (!(claim.conflictIds ?? []).length) fail(`CONFLICTED claim ${claim.id} has no conflict IDs`);
  for (const id of claim.conflictIds ?? []) {
    const conflict = (conflicts.conflicts ?? []).find((x) => x.id === id);
    if (!conflict || !activeStatuses.has(conflict.status))
      fail(`CONFLICTED claim ${claim.id} is not backed by an active conflict`);
  }
}
for (const binding of bindings.bindings ?? []) {
  if (activeClaims.has(binding.claimId) && binding.assertionMode === 'current') {
    fail(`${binding.id} renders active-conflict claim ${binding.claimId} as current`);
  }
}
if (failures) process.exit(1);
console.log(
  `PASS conflict gates (${activeClaims.size} active affected claim(s), ${conflicts.conflicts?.length ?? 0} records).`,
);
