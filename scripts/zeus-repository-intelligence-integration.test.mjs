import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyGraphEscalation, normaliseGraphPreflight } from './lib/zeus-repository-evidence.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function run(...args) {
  const result = spawnSync(process.execPath, ['scripts/zeus.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

{
  const status = run('graph', '--json', 'status');
  assert.equal(status.fresh, true, 'integration tests require a fresh repository graph');
}

{
  const truncated = normaliseGraphPreflight(
    {
      uncertainty: false,
      context: { truncated: true },
      impact: { truncated: false },
      verification: {
        level: 'renderer_ui',
        uncertain: false,
        commands: ['pnpm lint'],
      },
    },
    {
      verification_frontiers: {
        protected: ['pnpm zeus:validate', 'pnpm lint', 'pnpm typecheck', 'pnpm test', 'pnpm build'],
      },
    },
  );
  assert.equal(truncated.uncertainty, true, 'truncated graph coverage must be uncertain');
  assert.equal(truncated.truncation_uncertainty, true);
  assert.equal(truncated.verification.level, 'protected');
  assert.equal(truncated.verification.uncertain, true);

  const escalated = applyGraphEscalation({ risk: 'low', tier: 'fast', checks: [] }, truncated);
  assert.equal(escalated.risk, 'high');
  assert.equal(escalated.tier, 'deep');
  for (const check of ['zeus:validate', 'lint', 'typecheck', 'test', 'build']) {
    assert(escalated.checks.includes(check), `truncated graph evidence must require ${check}`);
  }
}

{
  const compiled = run(
    'compile',
    '--task',
    'Change the canonical building model',
    '--format',
    'json',
    '--graph-seed',
    'packages/bim-core',
  );
  assert.equal(compiled.repositoryIntelligence.fresh, true);
  assert.equal(compiled.repositoryIntelligence.verification.level, 'protected');
  assert(compiled.repositoryIntelligence.seeds.resolved.length > 0);
  assert.equal(compiled.repositoryIntelligence.source.rank, 1);
  assert.deepEqual(compiled.repositoryIntelligence.source.provenance, [
    'deterministic',
    'declared',
  ]);
}

{
  const compiled = run(
    'compile',
    '--task',
    'Fix a README typo',
    '--format',
    'json',
    '--graph-seed',
    'packages/bim-core',
  );
  assert.equal(compiled.repositoryEscalation.from.tier, 'fast');
  assert.equal(compiled.repositoryEscalation.to.tier, 'deep');
  assert.equal(compiled.repositoryEscalation.from.risk, 'low');
  assert.equal(compiled.risk, 'high');
  assert.equal(compiled.tier, 'deep');
  assert.equal(compiled.repositoryIntelligence.context_budget.max_context_chars, 8000);
  assert(JSON.stringify(compiled.repositoryIntelligence.context).length <= 8000);
  for (const check of ['zeus:validate', 'lint', 'typecheck', 'test', 'build']) {
    assert(compiled.checks.includes(check), `protected graph compile must require ${check}`);
  }
  assert(compiled.reviewers.length > 0, 'protected graph compile must require review');
}

{
  const compiled = run(
    'compile',
    '--task',
    'Fix .arq recovery',
    '--format',
    'json',
    '--graph-seed',
    'apps/web',
  );
  assert.equal(compiled.risk, 'high', 'graph evidence must not lower task risk');
  assert.equal(compiled.tier, 'deep', 'graph evidence must not lower the task tier');
}

{
  const impact = run('impact', '--files', 'packages/bim-core/package.json');
  assert.equal(impact.graph.fresh, true);
  assert.equal(impact.graph.verification.level, 'protected');
  assert.equal(impact.risk, 'high');
  for (const check of ['zeus:validate', 'lint', 'typecheck', 'test', 'build']) {
    assert(impact.checks.includes(check), `protected graph impact must require ${check}`);
  }
}

const runtimeStateProbe = path.join(root, '.zeus', 'gates', '__graph_state_probe__.json');
try {
  mkdirSync(path.dirname(runtimeStateProbe), { recursive: true });
  writeFileSync(runtimeStateProbe, '{"runtimeState":true}\n');
  const status = run('graph', '--json', 'status');
  assert.equal(
    status.fresh,
    true,
    'runtime ledger writes must not stale repository graph evidence',
  );
} finally {
  rmSync(runtimeStateProbe, { force: true });
}

const probe = path.join(root, 'scripts', '__zeus_graph_stale_probe__.mjs');
try {
  writeFileSync(probe, 'export const graphStaleProbe = true;\n');

  const impact = run('impact', '--files', 'packages/bim-core/package.json');
  assert.equal(impact.graph.fresh, false);
  assert.equal(impact.graph.uncertainty, true);
  assert.equal(impact.graph.verification.level, 'protected');
  assert.equal(impact.risk, 'high');

  const compiled = run(
    'compile',
    '--task',
    'Inspect the canonical model',
    '--format',
    'json',
    '--graph-seed',
    'packages/bim-core',
  );
  assert.equal(compiled.repositoryIntelligence.fresh, false);
  assert.equal(compiled.repositoryIntelligence.uncertainty, true);
  assert.equal(compiled.risk, 'high');
  assert.equal(compiled.tier, 'deep');
  assert.equal(compiled.repositoryEscalation.reason, 'protected-or-uncertain-repository-impact');
} finally {
  rmSync(probe, { force: true });
}

console.log('ZEUS repository-intelligence integration regressions passed.');
