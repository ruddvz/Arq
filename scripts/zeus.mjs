#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
const dir = dirname(new URL(import.meta.url).pathname);
const [cmd, ...args] = process.argv.slice(2);
const map = {
  compile: 'zeus-fast-compile.mjs',
  route: 'zeus-module-route.mjs',
  method: 'zeus-method.mjs',
  evidence: 'zeus-evidence.mjs',
  index: 'zeus-index.mjs',
  context: 'zeus-context.mjs',
  impact: 'zeus-impact.mjs',
  check: 'zeus-check.mjs',
  validate: 'zeus-validate.mjs',
  doctor: 'zeus-doctor.mjs',
  preflight: 'zeus-preflight.mjs',
  release: 'zeus-release-gate.mjs',
  benchmark: 'zeus-benchmark.mjs',
  verify: 'zeus-verify.mjs',
  status: 'zeus-github-status.mjs',
  ci: 'zeus-ci-triage.mjs',
  deploy: 'zeus-deploy-status.mjs',
  smoke: 'zeus-production-smoke.mjs',
};
if (!map[cmd]) {
  console.error('Usage: zeus ' + Object.keys(map).join('|'));
  process.exit(2);
}
const r = spawnSync(process.execPath, [join(dir, map[cmd]), ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);
