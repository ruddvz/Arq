#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one replacement anchor, found ${count}`);
  writeFileSync(path, source.replace(before, after));
}

for (const path of [
  'scripts/run-canvas-2d-benchmark.mjs',
  'scripts/run-canvaskit-benchmark.mjs',
  'scripts/run-pixijs-webgl-benchmark.mjs',
  'scripts/run-render-frame-benchmark.mjs',
]) {
  replaceOnce(
    path,
    '      fixture: authority.fixture,\n',
    '      fixtureContract: authority.fixtureContract,\n      evidenceFixture: workflow.evidenceFixture,\n',
  );
}

replaceOnce(
  'scripts/run-core-workflow-performance.mjs',
  '      fixtureId: null,\n',
  '      fixtureId: workflow.evidenceFixture?.id ?? null,\n',
);

replaceOnce(
  'scripts/run-material-compositing-performance.mjs',
  "      fixtureId: 'shell-material-probe-v1',\n",
  '      fixtureId: workflow.evidenceFixture?.id ?? null,\n',
);

const checkerPath = 'scripts/check-performance-authority.mjs';
const checker = readFileSync(checkerPath, 'utf8');
const marker = "if (authority.targets !== undefined || authority.benchmarkModel !== undefined || authority.ciBaselines !== undefined) {";
if (!checker.includes(marker)) throw new Error('authority checker insertion anchor missing');
const provenanceCheck = `const provenanceConsumers = [
  'scripts/run-canvas-2d-benchmark.mjs',
  'scripts/run-canvaskit-benchmark.mjs',
  'scripts/run-pixijs-webgl-benchmark.mjs',
  'scripts/run-render-frame-benchmark.mjs',
];
for (const relative of provenanceConsumers) {
  const source = readFileSync(path.join(repoRoot, relative), 'utf8');
  if (source.includes('authority.fixture')) fail(\`${'${relative}'}: ambiguous authority.fixture consumer must not return\`);
  if (!source.includes('fixtureContract: authority.fixtureContract')) fail(\`${'${relative}'}: fixtureContract provenance is absent\`);
  if (!source.includes('evidenceFixture: workflow.evidenceFixture')) fail(\`${'${relative}'}: evidenceFixture provenance is absent\`);
}

`;
writeFileSync(checkerPath, checker.replace(marker, `${provenanceCheck}${marker}`));

console.log('Staged #402 runner provenance repairs.');
