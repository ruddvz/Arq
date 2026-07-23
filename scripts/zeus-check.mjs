#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
const a = process.argv.slice(2);
const val = (n, d = null) => {
  const i = a.indexOf(`--${n}`);
  return i >= 0 ? a[i + 1] : d;
};
const tier = val('tier', 'fast');
if (!['fast', 'standard', 'deep'].includes(tier)) {
  console.error('tier fast|standard|deep');
  process.exit(2);
}
const root = val('root', process.cwd());
const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));
const config = JSON.parse(readFileSync(join(packageRoot, '.zeus', 'config.json'), 'utf8'));
const impactR = spawnSync(
  process.execPath,
  [
    join(packageRoot, 'scripts', 'zeus-impact.mjs'),
    '--root',
    root,
    ...(val('task') ? ['--task', val('task')] : []),
  ],
  { encoding: 'utf8' },
);
if (impactR.status !== 0) {
  process.stderr.write(impactR.stderr);
  process.exit(1);
}
const impact = JSON.parse(impactR.stdout);
const fpR = spawnSync(
  process.execPath,
  [join(packageRoot, 'scripts', 'zeus-fingerprint.mjs'), '--root', root],
  { encoding: 'utf8' },
);
const fingerprint = fpR.status === 0 ? JSON.parse(fpR.stdout).fingerprint : null;
let pkg = {};
try {
  pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
} catch {}
const pm = existsSync(join(root, 'pnpm-lock.yaml'))
  ? 'pnpm'
  : existsSync(join(root, 'yarn.lock'))
    ? 'yarn'
    : 'npm';
const available = pkg.scripts ?? {};
let names = [...impact.checks];
if (tier === 'standard')
  names = [...new Set([...names, 'format:check', 'lint', 'typecheck', 'test', 'build'])];
if (tier === 'deep')
  names = [...new Set([...names, 'format:check', 'lint', 'typecheck', 'test', 'build'])];
names = names.filter((n) => available[n]);
const cacheFile = join(root, config.cache.directory, 'checks.json');
mkdirSync(dirname(cacheFile), { recursive: true });
let cache = {};
try {
  cache = JSON.parse(readFileSync(cacheFile, 'utf8'));
} catch {}
const useCache =
  tier === 'fast' &&
  impact.risk !== 'high' &&
  impact.risk !== 'critical' &&
  !a.includes('--no-cache');
const results = [];
const run = (name, cmd, args, timeout) => {
  const key = `${fingerprint}:${name}`;
  const old = cache[key];
  if (
    useCache &&
    old &&
    Date.now() - old.at < config.cache.checkTtlSeconds * 1000 &&
    old.status === 'pass'
  ) {
    results.push({ name, status: 'pass', cached: true });
    return;
  }
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    timeout,
    maxBuffer: 20 * 1024 * 1024,
  });
  const status = r.status === 0 ? 'pass' : 'fail';
  results.push({
    name,
    status,
    cached: false,
    exit: r.status,
    output: ((r.stdout ?? '') + '\n' + (r.stderr ?? '')).trim().slice(-4000),
  });
  if (status === 'pass' && useCache) cache[key] = { at: Date.now(), status: 'pass' };
};
run(
  'preflight',
  process.execPath,
  [join(packageRoot, 'scripts', 'zeus-preflight.mjs'), '--allow-dirty'],
  config.timeoutsMs.focused,
);
for (const n of names) {
  const args = pm === 'npm' ? ['run', n] : [n];
  run(n, pm, args, n === 'build' ? config.timeoutsMs.build : config.timeoutsMs.package);
}
if (tier === 'deep') {
  run(
    'architecture lint',
    process.execPath,
    [join(packageRoot, 'scripts', 'zeus-architecture-lint.mjs'), root],
    config.timeoutsMs.package,
  );
  run(
    'security lint',
    process.execPath,
    [join(packageRoot, 'scripts', 'zeus-security-lint.mjs'), root],
    config.timeoutsMs.package,
  );
}
if (useCache) writeFileSync(cacheFile, JSON.stringify(cache, null, 2));
const failed = results.some((x) => x.status === 'fail');
console.log(
  JSON.stringify(
    { status: failed ? 'failed' : 'green', tier, impact, cacheUsed: useCache, results },
    null,
    2,
  ),
);
process.exit(failed ? 1 : 0);
