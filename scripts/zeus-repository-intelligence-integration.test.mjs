import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const probe = path.join(root, 'scripts', '__zeus_graph_stale_probe__.mjs');
try {
  writeFileSync(probe, "export const graphStaleProbe = true;\n");

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
} finally {
  rmSync(probe, { force: true });
}

console.log('ZEUS repository-intelligence integration regressions passed.');
