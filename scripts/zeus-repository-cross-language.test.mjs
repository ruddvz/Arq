import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { buildGraph, impactSlice, loadConfig } from './zeus-repository-cross-language.mjs';

function git(root, ...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}
function write(root, rel, content) {
  const full = path.join(root, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, content);
}
function packageFile(root, packageName, source = 'export const value = 1;\n') {
  write(root, `packages/${packageName}/package.json`, `${JSON.stringify({ name: `@arq/${packageName}`, type: 'module' }, null, 2)}\n`);
  write(root, `packages/${packageName}/src/index.ts`, source);
}
function fixtureConfig() {
  return {
    protocol: 'zeus-repository-intelligence/v1',
    schema_version: 1,
    extractor_version: 'cross-language-test',
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
  };
}
function makeRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'zeus-cross-language-'));
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'zeus@example.test');
  git(root, 'config', 'user.name', 'Zeus Test');
  write(root, '.zeus/repository-graph.json', `${JSON.stringify(fixtureConfig(), null, 2)}\n`);
  write(root, '.zeus/repository-graph-declarations.json', `${JSON.stringify({ protocol: 'zeus-repository-intelligence/v1', edges: [] }, null, 2)}\n`);
  return root;
}
function commitFixture(root) {
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'fixture');
}

test('Rust changes propagate through wasm-bindgen into TypeScript and UI consumers within budget', () => {
  const root = makeRepo();
  write(root, 'rust/arq-core/Cargo.toml', `[package]\nname = "arq-core"\nversion = "0.1.0"\nedition = "2021"\n\n[lib]\ncrate-type = ["cdylib", "rlib"]\n\n[dependencies]\nwasm-bindgen = "0.2"\n`);
  write(root, 'rust/arq-core/src/lib.rs', 'pub mod hashing;\npub mod wasm_bindings;\n');
  write(root, 'rust/arq-core/src/hashing.rs', 'pub fn semantic_hash() -> u64 { 7 }\n');
  write(root, 'rust/arq-core/src/wasm_bindings.rs', `use wasm_bindgen::prelude::*;\nuse crate::hashing::semantic_hash;\n\n#[wasm_bindgen(js_name = semanticHash)]\npub fn semantic_hash_js() -> u64 { semantic_hash() }\n`);
  packageFile(root, 'rust-bindings', `export { semanticHash } from 'arq-core';\n`);
  write(root, 'apps/web/src/app.ts', `import { semanticHash } from '@arq/rust-bindings';\nexport const hash = semanticHash;\n`);
  commitFixture(root);

  const cfg = loadConfig(root);
  const graph = buildGraph(root, cfg);
  assert(graph.edges.some((edge) => edge.source === 'file:rust/arq-core/src/wasm_bindings.rs' && edge.target === 'file:rust/arq-core/src/hashing.rs' && edge.extractor === 'rust-module-extractor'));
  assert(graph.edges.some((edge) => edge.source === 'package:rust/arq-core' && edge.target === 'file:rust/arq-core/src/wasm_bindings.rs' && edge.authority === 'wasm-bindgen-interface'));
  assert(graph.edges.some((edge) => edge.source === 'package:packages/rust-bindings' && edge.target === 'package:rust/arq-core' && edge.authority === 'package-entrypoint-dependency'));

  const impact = impactSlice(graph.nodes, graph.edges, ['file:rust/arq-core/src/hashing.rs'], cfg.budgets);
  const ids = new Set(impact.nodes.map((item) => item.id));
  assert(ids.has('file:rust/arq-core/src/wasm_bindings.rs'));
  assert(ids.has('package:rust/arq-core'));
  assert(ids.has('package:packages/rust-bindings'));
  assert(ids.has('file:apps/web/src/app.ts'));
  assert.equal(impact.truncated, false);
});

test('tsconfig aliases and barrel re-exports preserve deterministic downstream reachability', () => {
  const root = makeRepo();
  write(root, 'tsconfig.json', `${JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@kernel/*': ['packages/kernel/src/*'] } } }, null, 2)}\n`);
  packageFile(root, 'kernel', `export { coreValue } from '@kernel/core';\n`);
  write(root, 'packages/kernel/src/core.ts', 'export const coreValue = 42;\n');
  write(root, 'apps/web/src/kernel-consumer.ts', `import { coreValue } from '@arq/kernel';\nexport const rendered = coreValue;\n`);
  commitFixture(root);

  const cfg = loadConfig(root);
  const graph = buildGraph(root, cfg);
  assert(graph.edges.some((edge) => edge.source === 'file:packages/kernel/src/index.ts' && edge.target === 'file:packages/kernel/src/core.ts' && edge.authority === 'tsconfig-path-alias'));
  assert(graph.edges.some((edge) => edge.source === 'package:packages/kernel' && edge.target === 'file:packages/kernel/src/core.ts' && edge.authority === 'package-entrypoint-dependency'));

  const impact = impactSlice(graph.nodes, graph.edges, ['file:packages/kernel/src/core.ts'], cfg.budgets);
  const ids = new Set(impact.nodes.map((item) => item.id));
  assert(ids.has('package:packages/kernel'));
  assert(ids.has('file:apps/web/src/kernel-consumer.ts'));
  assert.equal(impact.truncated, false);
});

test('ambiguous tsconfig alias targets stay explicit and do not become hard dependency edges', () => {
  const root = makeRepo();
  write(root, 'tsconfig.json', `${JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@ambiguous': ['packages/a/src/index', 'packages/b/src/index'] } } }, null, 2)}\n`);
  packageFile(root, 'a');
  packageFile(root, 'b');
  write(root, 'apps/web/src/app.ts', `import { value } from '@ambiguous';\nexport { value };\n`);
  commitFixture(root);

  const graph = buildGraph(root, loadConfig(root));
  const app = graph.nodes.get('file:apps/web/src/app.ts');
  assert.equal(app.metadata.ambiguous_imports.length, 1);
  assert.deepEqual(app.metadata.ambiguous_imports[0].candidates, ['packages/a/src/index.ts', 'packages/b/src/index.ts']);
  assert.equal(graph.edges.some((edge) => edge.source === 'file:apps/web/src/app.ts' && edge.authority === 'tsconfig-path-alias'), false);
});
