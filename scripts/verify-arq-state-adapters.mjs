#!/usr/bin/env node
/** Verify implementation-specific visible state is translated through a canonical message. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const languageRoot = resolve(value('--language-root', PACKAGE_ROOT));
const repoRoot = value('--repo-root', null);
const locate = (name) => {
  const candidates = [join(languageRoot, `02-canonical/${name}`), join(languageRoot, name)];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Missing ${name}`);
  return found;
};
const adapters = JSON.parse(readFileSync(locate('ui-state-adapter-map.json'), 'utf8'));
const messages = JSON.parse(readFileSync(locate('message-contract.json'), 'utf8'));
const messageIds = new Set(messages.messages.map((x) => x.id));
let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};
for (const adapter of adapters.adapters ?? []) {
  const ids = new Set();
  for (const state of adapter.states ?? []) {
    if (ids.has(state.internal)) fail(`${adapter.id} duplicates ${state.internal}`);
    ids.add(state.internal);
    if (!messageIds.has(state.canonicalMessageId))
      fail(`${adapter.id}/${state.internal} has no canonical message`);
  }
  if (repoRoot && adapter.id === 'web-plan-journal-status') {
    const path = join(resolve(repoRoot), adapter.sourcePath);
    if (!existsSync(path)) fail(`${adapter.id} source missing: ${adapter.sourcePath}`);
    else {
      const text = readFileSync(path, 'utf8');
      const match = text.match(/useState<\s*([\s\S]*?)>\s*\(\s*'no-project'\s*\)/);
      if (!match) fail(`${adapter.id} could not extract saveState union`);
      else {
        const sourceStates = new Set([...match[1].matchAll(/'([^']+)'/g)].map((x) => x[1]));
        for (const state of sourceStates)
          if (!ids.has(state)) fail(`${adapter.id} does not map source state ${state}`);
        for (const state of ids)
          if (!sourceStates.has(state)) fail(`${adapter.id} has stale state ${state}`);
      }
    }
  }
}
if (failures) process.exit(1);
console.log(
  `PASS ${adapters.adapters?.length ?? 0} state adapters map visible implementation states to canonical messages.`,
);
