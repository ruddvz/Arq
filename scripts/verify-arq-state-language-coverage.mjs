#!/usr/bin/env node
/** Verify every canonical workspace/file state has one explicit language mapping. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const languageRoot = resolve(value('--language-root', join(PACKAGE_ROOT, 'docs/product/voice')));
const repoContextPath = value('--repo-context', null);
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
function locate(rel) {
  const compact = rel.replace(/^02-canonical\//, '');
  const candidates = [
    join(languageRoot, rel),
    join(languageRoot, compact),
    join(languageRoot, rel.replace(/^02-canonical\/snapshots\//, 'snapshots/')),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Missing ${rel} under ${languageRoot}`);
  return found;
}

const language = json(locate('02-canonical/state-language-map.json'));
let sourceMachines = {};
let externalMachines = {};
if (repoContextPath) {
  const path = resolve(repoContextPath);
  if (!existsSync(path)) throw new Error(`repo context missing: ${path}`);
  const context = json(path);
  /*
   * The generated context's schema version is owned by context-contract.json
   * (contextSchemaVersion), which refresh-arq-language-context.mjs writes. Read
   * it rather than pinning a literal here: the package shipped this check
   * pinned to 3 while the refresh script already emitted 4, so a live
   * --repo-context run threw instead of verifying coverage.
   */
  const expectedSchema = json(locate('02-canonical/context-contract.json')).contextSchemaVersion;
  if (!Number.isInteger(expectedSchema)) {
    throw new Error('context contract does not declare contextSchemaVersion');
  }
  if (context.schemaVersion !== expectedSchema) {
    throw new Error(`repo context schema must be ${expectedSchema}`);
  }
  sourceMachines = context.registries?.states?.machines ?? {};
  externalMachines = context.externalStates ?? {};
} else {
  const index = json(locate('02-canonical/snapshot-index.json'));
  const snapshot = index.snapshots?.find((x) => x.kind === 'interface');
  if (!snapshot) throw new Error('snapshot index has no interface snapshot');
  const data = json(locate(snapshot.path));
  sourceMachines = data.stateMachines ?? {};
  externalMachines = data.externalStateMachines ?? {};
}

let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FAIL ${message}`);
};
function verifyMachine(machine, states, sourceKind) {
  const entries = language.machines?.[machine];
  if (!Array.isArray(entries))
    return fail(`no language mapping for ${sourceKind} state machine ${machine}`);
  const mapped = new Set(entries.map((x) => x.internal));
  const source = new Set(states);
  for (const state of source)
    if (!mapped.has(state)) fail(`unmapped ${sourceKind} state ${machine}/${state}`);
  for (const entry of entries) {
    if (!source.has(entry.internal)) fail(`stale mapping ${machine}/${entry.internal}`);
    const labelCount = Number(Boolean(entry.label)) + Number(Boolean(entry.labelTemplate));
    if (labelCount !== 1) fail(`${machine}/${entry.internal} needs exactly one label form`);
    if (!['product', 'diagnostic', 'internal'].includes(entry.exposure))
      fail(`${machine}/${entry.internal} has invalid exposure`);
  }
}
for (const [machine, states] of Object.entries(sourceMachines))
  verifyMachine(machine, states, 'workspace');
for (const [machine, states] of Object.entries(externalMachines))
  verifyMachine(machine, states, 'external');
if (failures) {
  console.error(`\n${failures} state-language coverage failure(s).`);
  process.exit(1);
}
console.log(
  `PASS state-language coverage for ${Object.keys(sourceMachines).length} workspace and ${Object.keys(externalMachines).length} external state machines.`,
);
