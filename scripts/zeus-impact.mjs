#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { route, classifyPaths, globToRe, blastRadius } from './lib/zeus-engine.mjs';
import { applyGraphEscalation, repositoryEvidence } from './lib/zeus-repository-evidence.mjs';

const a = process.argv.slice(2);
const val = (n) => {
  const i = a.indexOf(`--${n}`);
  return i >= 0 ? a[i + 1] : null;
};
const root = val('root') ?? process.cwd();
const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));
const map = JSON.parse(readFileSync(join(packageRoot, '.zeus', 'impact-map.json'), 'utf8'));

let files = [];
if (val('files')) files = val('files').split(',').filter(Boolean);
else {
  const r = spawnSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' });
  files = (r.stdout ?? '')
    .split('\n')
    .filter(Boolean)
    .map((x) => x.slice(3).trim())
    .filter(Boolean);
}

const modules = new Set();
const checks = new Set();
const rank = { low: 0, moderate: 1, high: 2, critical: 3 };
const radiusRank = Object.fromEntries(blastRadius.levels.map((l) => [l.id, l.rank]));
const reversibilityRank = Object.fromEntries(blastRadius.reversibility.map((r) => [r.id, r.rank]));

let risk = 'low';
for (const f of files) {
  for (const p of map.patterns) {
    if (!globToRe(p.glob).test(f)) continue;
    for (const m of p.modules) modules.add(m);
    for (const c of p.checks) checks.add(c);
    if (rank[p.risk] > rank[risk]) risk = p.risk;
  }
}

// Zeus 5: the changed paths themselves carry a blast radius and a reversibility
// cost, independent of how the task was worded.
const fromPaths = classifyPaths(files);
let blast = fromPaths.blastRadius;
let reversibility = fromPaths.reversibility;

const task = val('task');
let fromTask = null;
if (task) {
  const r = route(task);
  fromTask = {
    mode: r.mode,
    risk: r.risk,
    tier: r.tier,
    blastRadius: r.blastRadius,
    reversibility: r.reversibility,
  };
  for (const m of r.modules) modules.add(m.id);
  if (rank[r.risk] > rank[risk]) risk = r.risk;
  if (radiusRank[r.blastRadius] > radiusRank[blast]) blast = r.blastRadius;
  if (reversibilityRank[r.reversibility] > reversibilityRank[reversibility]) {
    reversibility = r.reversibility;
  }
}

// Blast radius can raise risk. It never lowers it.
if (radiusRank[blast] >= radiusRank.persistent && rank[risk] < rank.high) risk = 'high';
if (reversibility === 'irreversible' && rank[risk] < rank.high) risk = 'high';

// Repository intelligence is additive. A protected or uncertain graph result
// may raise risk and add checks, but graph sparsity never lowers an existing
// path/task classification or removes an existing check.
const graph = files.length ? repositoryEvidence(root, files, fromTask?.tier ?? 'standard') : null;
if (graph) {
  const escalated = applyGraphEscalation({ risk, checks: [...checks] }, graph);
  risk = escalated.risk;
  for (const check of escalated.checks) checks.add(check);
}

console.log(
  JSON.stringify(
    {
      files,
      modules: [...modules],
      checks: [...checks],
      risk,
      blastRadius: blast,
      reversibility,
      fromPaths,
      fromTask,
      graph,
    },
    null,
    2,
  ),
);
