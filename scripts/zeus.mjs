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
  graph: 'zeus-repository-intelligence.mjs',
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
  // Wired 2026-08-22. These seven existed and were reachable by nothing: not the
  // CLI, not a package script, not the hook, not CI, not a document. The whole
  // end-to-end pipeline Zeus documents in .zeus/TASK-STATE-MACHINE.md lived in
  // zeus-run-state.mjs, and no path in the repository could run it.
  // scripts/zeus-drift-guard.mjs now fails when a Zeus script is unreachable.
  state: 'zeus-run-state.mjs',
  roles: 'zeus-role-plan.mjs',
  merge: 'zeus-merge-guard.mjs',
  watch: 'zeus-release-watch.mjs',
  'visual-contract': 'zeus-visual-contract-lint.mjs',
  cache: 'zeus-cache.mjs',
  stats: 'zeus-eval-stats.mjs',
  record: 'zeus-eval-record.mjs',
  gate: 'zeus-gate.mjs',
  plan: 'zeus-plan-ledger.mjs',
  spec: 'zeus-spec.mjs',
  harness: 'zeus-harness-state.mjs',
  drift: 'zeus-drift-guard.mjs',
};
if (!map[cmd]) {
  console.error('Usage: zeus ' + Object.keys(map).join('|'));
  process.exit(2);
}
const r = spawnSync(process.execPath, [join(dir, map[cmd]), ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);