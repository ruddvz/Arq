#!/usr/bin/env node
import { performance } from 'node:perf_hooks';
import { compile, route } from './lib/zeus-engine.mjs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
const a = process.argv.slice(2);
const val = (n, d = null) => {
  const i = a.indexOf(`--${n}`);
  return i >= 0 ? a[i + 1] : d;
};
const iterations = Number(val('iterations', '500'));
const root = val('root', process.cwd());
const scriptDir = dirname(new URL(import.meta.url).pathname);
const tasks = [
  'Fix a typo in the README',
  'Implement pixel-perfect responsive plan editor states',
  'Fix .arq migration recovery and CI, merge and deploy to production',
];
const times = [];
for (let i = 0; i < iterations; i++) {
  const t = performance.now();
  compile(tasks[i % tasks.length]);
  route(tasks[(i + 1) % tasks.length]);
  times.push(performance.now() - t);
}
times.sort((x, y) => x - y);
const pct = (p) => times[Math.min(times.length - 1, Math.floor(times.length * p))];
const contract = compile(tasks[0]);
const index1 = performance.now();
const r1 = spawnSync(process.execPath, [join(scriptDir, 'zeus-index.mjs'), '--root', root], {
  encoding: 'utf8',
});
const fresh = performance.now() - index1;
const index2 = performance.now();
const r2 = spawnSync(process.execPath, [join(scriptDir, 'zeus-index.mjs'), '--root', root], {
  encoding: 'utf8',
});
const hit = performance.now() - index2;
const context1 = performance.now();
const rc = spawnSync(
  process.execPath,
  [join(scriptDir, 'zeus-context.mjs'), '--root', root, '--query', 'Arq file storage recovery'],
  { encoding: 'utf8' },
);
const context = performance.now() - context1;
const report = {
  iterations,
  inProcessCompileAndRouteMs: { p50: pct(0.5), p95: pct(0.95), max: times.at(-1) },
  fastContractJsonChars: JSON.stringify(contract).length,
  projectIndex: {
    freshMs: fresh,
    freshStatus: r1.status,
    cacheHitMs: hit,
    cacheHitStatus: r2.status,
  },
  contextQuery: { ms: context, status: rc.status },
  targets: { compileRouteP95Ms: 5, contractChars: 4000, indexCacheHitMs: 250, contextQueryMs: 500 },
};
report.status =
  report.inProcessCompileAndRouteMs.p95 <= 5 &&
  report.fastContractJsonChars <= 4000 &&
  hit <= 250 &&
  context <= 500
    ? 'green'
    : 'partial';
console.log(JSON.stringify(report, null, 2));
process.exit(report.status === 'green' ? 0 : 3);
