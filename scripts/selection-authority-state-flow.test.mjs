#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function requireMatch(source, pattern, message) {
  if (!pattern.test(source)) {
    throw new Error(message);
  }
}

const app = read('apps/web/src/App.tsx');
const planCanvas = read('apps/web/src/PlanCanvas.tsx');
const modeState = read('packages/workspace/src/mode-state.ts');

requireMatch(
  planCanvas,
  /onSelectMany\(\s*selectWallsInRegion\(content,\s*boundsFromCorners\(marquee\.anchor, marquee\.corner\),\s*mode\),?\s*\)/s,
  'PlanCanvas no longer emits marquee results through onSelectMany(selectWallsInRegion(...))',
);

requireMatch(
  app,
  /onSelectMany=\{\(elementIds\)\s*=>\s*setModelSelection\(\{\s*primary:\s*elementIds\[0\]\s*\?\?\s*null,\s*secondary:\s*new Set\(elementIds\.slice\(1\)\),?\s*\}\)\s*\}/s,
  'App no longer maps the first Plan multi-selection id to primary and the remainder to secondary',
);

requireMatch(
  modeState,
  /selection:\s*\{\s*primaryId:\s*null,\s*secondaryIds:\s*new Set(?:<string>)?\(\),?\s*\}/s,
  'WorkspaceModeState.selection initial representation changed; re-audit the duplicate-state finding',
);

console.log('PASS selection-authority state-flow source contract');
console.log('- Plan marquee emits selectWallsInRegion(...) through onSelectMany');
console.log('- App maps first id to primary and remaining ids to secondary');
console.log('- WorkspaceModeState still carries its independent empty selection representation');
