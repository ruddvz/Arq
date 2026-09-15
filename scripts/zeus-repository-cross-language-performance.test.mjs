import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { spawnSync } from 'node:child_process';

import { buildGraph, impactSlice, loadConfig } from './zeus-repository-cross-language.mjs';

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

function write(root, rel, content) {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function makeRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'zeus-graph-performance-'));
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'zeus@example.test');
  git(root, 'config', 'user.name', 'Zeus Test');

  write(
    root,
    '.zeus/repository-graph.json',
    `${JSON.stringify(
      {
        protocol: 'zeus-repository-intelligence/v1',
        schema_version: 1,
        extractor_version: 'performance-test',
        hard_gate_provenance: ['deterministic', 'declared'],
        declarations: ['.zeus/repository-graph-declarations.json'],
        exclude_prefixes: ['.git/', 'node_modules/', 'dist/', 'build/', 'target/'],
        source_extensions: ['.js', '.mjs', '.ts', '.tsx', '.json', '.rs', '.toml', '.md'],
        budgets: { max_nodes: 240, max_depth: 4, max_context_chars: 28000 },
        protected_domains: ['semantic_model', 'operations', 'ai_operations', 'persistence', 'geometry_units', 'contract'],
        verification_frontiers: {
          harness: ['harness-check'],
          renderer_ui: ['renderer-check'],
          public_adapter: ['adapter-check'],
          protected: ['protected-check'],
        },
      },
      null,
      2,
    )}\n`,
  );
  write(
    root,
    '.zeus/repository-graph-declarations.json',
    `${JSON.stringify({ protocol: 'zeus-repository-intelligence/v1', edges: [] }, null, 2)}\n`,
  );

  const packageCount = 32;
  const modulesPerPackage = 12;
  for (let packageIndex = 0; packageIndex < packageCount; packageIndex += 1) {
    const packageName = `fixture-${packageIndex}`;
    write(
      root,
      `packages/${packageName}/package.json`,
      `${JSON.stringify({ name: `@arq/${packageName}`, type: 'module' }, null, 2)}\n`,
    );
    const previousImport =
      packageIndex === 0
        ? ''
        : `import '@arq/fixture-${packageIndex - 1}';\n`;
    write(
      root,
      `packages/${packageName}/src/index.ts`,
      `${previousImport}export { moduleValue } from './module-0';\n`,
    );
    for (let moduleIndex = 0; moduleIndex < modulesPerPackage; moduleIndex += 1) {
      write(
        root,
        `packages/${packageName}/src/module-${moduleIndex}.ts`,
        `export const moduleValue${moduleIndex} = ${packageIndex * modulesPerPackage + moduleIndex};\n`,
      );
    }
  }
  write(
    root,
    'apps/web/src/app.ts',
    `import '@arq/fixture-${packageCount - 1}';\nexport const app = true;\n`,
  );
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'representative graph fixture');
  return root;
}

test('repository-sized graph build and bounded impact query remain within generous CI ceilings', () => {
  const root = makeRepo();
  const config = loadConfig(root);

  const buildStarted = performance.now();
  const graph = buildGraph(root, config);
  const buildMs = performance.now() - buildStarted;

  const queryStarted = performance.now();
  const impact = impactSlice(
    graph.nodes,
    graph.edges,
    ['file:packages/fixture-0/src/module-0.ts'],
    config.budgets,
  );
  const queryMs = performance.now() - queryStarted;

  console.log(
    `ZEUS graph performance fixture: nodes=${graph.nodes.size} edges=${graph.edges.length} build=${buildMs.toFixed(1)}ms impact=${queryMs.toFixed(1)}ms`,
  );

  assert(graph.nodes.size >= 32 * 12);
  assert(impact.node_count <= config.budgets.max_nodes);
  assert(buildMs < 10_000, `graph build exceeded 10s CI ceiling: ${buildMs.toFixed(1)}ms`);
  assert(queryMs < 1_000, `impact query exceeded 1s CI ceiling: ${queryMs.toFixed(1)}ms`);
});
