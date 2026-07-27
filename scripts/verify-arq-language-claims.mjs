#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const languageRoot = resolve(
  args.includes('--language-root') ? args[args.indexOf('--language-root') + 1] : ROOT,
);
function locate(name) {
  const p = [join(languageRoot, `02-canonical/${name}`), join(languageRoot, name)].find(existsSync);
  if (!p) throw new Error(`Missing ${name}`);
  return p;
}
const claims = JSON.parse(readFileSync(locate('claim-registry.json'), 'utf8'));
const bindings = JSON.parse(readFileSync(locate('claim-binding-registry.json'), 'utf8'));
const conflicts = JSON.parse(readFileSync(locate('conflict-registry.json'), 'utf8'));
const byClaim = new Map(claims.claims.map((x) => [x.id, x]));
const active = new Set(
  (conflicts.conflicts ?? [])
    .filter((x) => (conflicts.activeStatuses ?? []).includes(x.status))
    .flatMap((x) => x.affectedClaimIds ?? []),
);
let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};
const ids = new Set();
for (const binding of bindings.bindings ?? []) {
  if (ids.has(binding.id)) fail(`duplicate claim binding ${binding.id}`);
  ids.add(binding.id);
  const claim = byClaim.get(binding.claimId);
  if (!claim) {
    fail(`${binding.id} references unknown claim ${binding.claimId}`);
    continue;
  }
  if (binding.assertionMode === 'current' && claim.state !== 'CURRENT')
    fail(`${binding.id} presents ${claim.state} claim as current`);
  if (
    binding.assertionMode === 'planned' &&
    !['PLANNED', 'DESIGNED_GATED', 'DEFERRED'].includes(claim.state)
  )
    fail(`${binding.id} is not bound to planned/gated claim state`);
  if (binding.assertionMode === 'must-qualify' && claim.state === 'CURRENT')
    fail(`${binding.id} unnecessarily forces qualification of current claim`);
  if (active.has(claim.id) && binding.assertionMode === 'current')
    fail(`${binding.id} cannot present active-conflict claim as current`);
  if (!binding.requiredRepair && claim.state !== 'CURRENT')
    fail(`${binding.id} needs a required repair/qualification`);
}
if (failures) process.exit(1);
console.log(
  `PASS ${bindings.bindings?.length ?? 0} claim bindings respect claim and conflict states.`,
);
