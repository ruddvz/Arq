import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  boundedContext,
  buildGraph,
  cachePath,
  classifyPath,
  collectDiff,
  diffImpactFromGraph,
  graphStatus,
  impactSlice,
  loadConfig,
  parseNameStatusZ,
  preflightFromGraph,
  resolveSeeds,
  sourceStateDigest,
  writeSnapshot,
} from './zeus-repository-intelligence.mjs';

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

const configTemplate = {
  protocol: 'zeus-repository-intelligence/v1',
  schema_version: 1,
  extractor_version: 'test',
  hard_gate_provenance: ['deterministic', 'declared'],
  declarations: ['.zeus/repository-graph-declarations.json'],
  exclude_prefixes: [
    '.git/',
    '.turbo/',
    'node_modules/',
    'coverage/',
    'dist/',
    'build/',
    'out/',
    'target/',
  ],
  source_extensions: ['.js', '.mjs', '.ts', '.tsx', '.json', '.rs', '.md', '.yml'],
  budgets: { max_nodes: 64, max_depth: 4, max_context_chars: 12000 },
  protected_domains: [
    'semantic_model',
    'operations',
    'ai_operations',
    'persistence',
    'geometry_units',
    'contract',
  ],
  verification_frontiers: {
    harness: ['harness-check'],
    renderer_ui: ['renderer-check'],
    public_adapter: ['adapter-check'],
    protected: ['protected-check'],
  },
};

const declarations = {
  protocol: 'zeus-repository-intelligence/v1',
  edges: [
    {
      source: 'package:packages/operations',
      target: 'package:packages/bim-core',
      relation: 'ACTS_ON',
      provenance: 'declared',
      authority: 'typed-operation-boundary',
    },
    {
      source: 'package:packages/plan-renderer',
      target: 'package:packages/bim-core',
      relation: 'RENDERS',
      provenance: 'declared',
      authority: 'derived-projection-boundary',
    },
    {
      source: 'package:packages/model-renderer',
      target: 'package:packages/bim-core',
      relation: 'RENDERS',
      provenance: 'declared',
      authority: 'derived-projection-boundary',
    },
    {
      source: 'package:packages/arqfs',
      target: 'package:packages/bim-core',
      relation: 'PERSISTS',
      provenance: 'declared',
      authority: 'native-project-persistence',
    },
    {
      source: 'package:packages/project-format',
      target: 'package:packages/bim-core',
      relation: 'PERSISTS',
      provenance: 'declared',
      authority: 'native-project-format',
    },
    {
      source: 'package:packages/local-storage',
      target: 'package:packages/arqfs',
      relation: 'DEPENDS_ON',
      provenance: 'declared',
      authority: 'browser-local-persistence',
    },
    {
      source: 'package:packages/derived-cache',
      target: 'package:packages/bim-core',
      relation: 'GENERATED_FROM',
      provenance: 'declared',
      authority: 'disposable-derived-state',
    },
    {
      source: 'package:packages/validation',
      target: 'package:packages/bim-core',
      relation: 'VALIDATES',
      provenance: 'declared',
      authority: 'deterministic-validation',
    },
    {
      source: 'package:packages/validation',
      target: 'package:packages/operations',
      relation: 'VALIDATES',
      provenance: 'declared',
      authority: 'deterministic-validation',
    },
  ],
};

function packageFile(root, packageName, source = 'export const value = 1;\n') {
  write(
    root,
    `packages/${packageName}/package.json`,
    JSON.stringify({ name: `@arq/${packageName}`, type: 'module' }),
  );
  write(root, `packages/${packageName}/src/index.ts`, source);
}

function makeRepo() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'zeus-graph-'));
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.email', 'zeus@example.test');
  git(root, 'config', 'user.name', 'Zeus Test');
  write(root, '.zeus/repository-graph.json', `${JSON.stringify(configTemplate, null, 2)}\n`);
  write(
    root,
    '.zeus/repository-graph-declarations.json',
    `${JSON.stringify(declarations, null, 2)}\n`,
  );
  packageFile(root, 'bim-core', 'export const modelRevision = 1;\n');
  packageFile(
    root,
    'operations',
    "import { modelRevision } from '@arq/bim-core';\nexport const op = modelRevision;\n",
  );
  packageFile(
    root,
    'plan-renderer',
    "import { modelRevision } from '@arq/bim-core';\nexport const plan = modelRevision;\n",
  );
  packageFile(
    root,
    'model-renderer',
    "import { modelRevision } from '@arq/bim-core';\nexport const model = modelRevision;\n",
  );
  packageFile(root, 'arqfs');
  packageFile(root, 'project-format');
  packageFile(root, 'local-storage');
  packageFile(root, 'derived-cache');
  packageFile(root, 'validation');
  packageFile(root, 'geometry-2d');
  write(root, 'packages/operations/src/ai-proposal.ts', 'export const proposedOperation = true;\n');
  write(root, 'apps/web/src/app.ts', "import '@arq/plan-renderer';\nexport const app = true;\n");
  write(
    root,
    'contracts/project-schema.ts',
    'export type ProjectContract = { revision: number };\n',
  );
  write(root, 'scripts/zeus-check.mjs', 'export const ok = true;\n');
  write(root, 'tests/model.test.ts', "import '../packages/bim-core/src/index.ts';\n");
  git(root, 'add', '.');
  git(root, 'commit', '-m', 'fixture');
  return { root, config: loadConfig(root) };
}

function graph(root, config) {
  const built = buildGraph(root, config);
  return { nodes: built.nodes, edges: built.edges };
}

test('classifies ARQ authority surfaces without promoting renderers', () => {
  assert.deepEqual(classifyPath('packages/bim-core/src/model.ts'), {
    domain: 'semantic_model',
    authority: 'canonical',
    protected: true,
  });
  assert.equal(classifyPath('packages/model-renderer/src/index.ts').authority, 'derived');
  assert.equal(classifyPath('packages/plan-renderer/src/index.ts').authority, 'derived');
  assert.equal(classifyPath('packages/derived-cache/src/index.ts').authority, 'derived');
  assert.equal(classifyPath('packages/arqfs/src/index.ts').domain, 'persistence');
  assert.equal(classifyPath('packages/project-format/src/index.ts').protected, true);
  assert.equal(classifyPath('packages/geometry-2d/src/index.ts').domain, 'geometry_units');
  assert.equal(classifyPath('packages/operations/src/ai-proposal.ts').domain, 'ai_operations');
});

test('package nodes preserve semantic authority versus derived renderer authority', () => {
  const { root, config } = makeRepo();
  const { nodes } = graph(root, config);
  assert.equal(nodes.get('package:packages/bim-core').authority, 'canonical');
  assert.equal(nodes.get('package:packages/bim-core').protected, true);
  assert.equal(nodes.get('package:packages/model-renderer').authority, 'derived');
  assert.equal(nodes.get('package:packages/plan-renderer').authority, 'derived');
  assert.equal(nodes.get('package:packages/arqfs').authority, 'persistence-contract');
});

test('semantic-model downstream impact reaches consumers without authority inversion', () => {
  const { root, config } = makeRepo();
  const { nodes, edges } = graph(root, config);
  const result = impactSlice(nodes, edges, ['package:packages/bim-core'], config.budgets);
  const ids = new Set(result.nodes.map((item) => item.id));
  assert(ids.has('package:packages/operations'));
  assert(ids.has('package:packages/arqfs'));
  assert(ids.has('package:packages/plan-renderer'));
  assert(ids.has('package:packages/model-renderer'));
  assert(ids.has('package:packages/derived-cache'));
  assert(ids.has('package:packages/validation'));
  assert.equal(nodes.get('package:packages/bim-core').authority, 'canonical');
  assert.equal(nodes.get('package:packages/model-renderer').authority, 'derived');
});

test('workspace imports become deterministic dependency edges', () => {
  const { root, config } = makeRepo();
  const { edges } = graph(root, config);
  assert(
    edges.some(
      (edge) =>
        edge.source === 'file:packages/operations/src/index.ts' &&
        edge.target === 'package:packages/bim-core' &&
        edge.relation === 'DEPENDS_ON' &&
        edge.provenance === 'deterministic',
    ),
  );
});

test('snapshot is fresh until relevant source state changes', () => {
  const { root, config } = makeRepo();
  writeSnapshot(root, config);
  assert.equal(graphStatus(root, config).fresh, true);
  write(root, 'packages/bim-core/src/new-entity.ts', 'export const entity = true;\n');
  const stale = graphStatus(root, config);
  assert.equal(stale.fresh, false);
  assert.equal(stale.checks.source_state_digest, false);
});

test('snapshot freshness is bound to branch identity at the same revision', () => {
  const { root, config } = makeRepo();
  writeSnapshot(root, config);
  git(root, 'branch', 'alternate');
  git(root, 'checkout', 'alternate');
  const stale = graphStatus(root, config);
  assert.equal(stale.fresh, false);
  assert.equal(stale.checks.branch, false);
  assert.equal(stale.checks.fingerprint, false);
});

test('generated and vendor-like trees do not change source-state digest', () => {
  const { root, config } = makeRepo();
  const before = sourceStateDigest(root, config);
  write(root, 'dist/generated.js', 'generated\n');
  write(root, 'build/output.json', '{}\n');
  assert.equal(sourceStateDigest(root, config), before);
});

test('linked worktrees receive different cache paths', () => {
  const { root } = makeRepo();
  const sibling = `${root}-worktree`;
  git(root, 'worktree', 'add', '-b', 'other', sibling, 'HEAD');
  assert.notEqual(cachePath(root), cachePath(sibling));
});

test('bounded context is cycle-safe and respects node and character ceilings', () => {
  const { root, config } = makeRepo();
  const { nodes, edges } = graph(root, config);
  edges.push({
    source: 'package:packages/bim-core',
    target: 'package:packages/operations',
    relation: 'DEPENDS_ON',
    provenance: 'deterministic',
    authority: 'test-cycle',
  });
  const limited = boundedContext(nodes, edges, ['package:packages/bim-core'], {
    max_nodes: 4,
    max_depth: 20,
    max_context_chars: 3000,
  });
  assert(limited.node_count <= 4);
  assert.equal(limited.truncated, true);
  assert(JSON.stringify(limited).length <= 3500);
});

test('missing and ambiguous seeds are reported rather than guessed', () => {
  const { root, config } = makeRepo();
  write(root, 'packages/bim-core/src/duplicate.ts', 'export const a = 1;\n');
  write(root, 'packages/operations/src/duplicate.ts', 'export const b = 1;\n');
  const { nodes } = graph(root, config);
  const result = resolveSeeds(nodes, ['does-not-exist', 'duplicate.ts']);
  assert.deepEqual(result.unresolved, ['does-not-exist']);
  assert.equal(result.ambiguous['duplicate.ts'].length, 2);
});

test('preflight escalates semantic and persistence work to protected verification', () => {
  const { root, config } = makeRepo();
  const { nodes, edges } = graph(root, config);
  const semantic = preflightFromGraph(nodes, edges, ['bim-core'], config);
  assert.equal(semantic.uncertainty, false);
  assert.equal(semantic.verification.level, 'protected');
  const persistence = preflightFromGraph(nodes, edges, ['packages/arqfs'], config);
  assert.equal(persistence.verification.level, 'protected');
});

test('declarations reject inferred relationships', () => {
  const { root, config } = makeRepo();
  const altered = JSON.parse(
    readFileSync(path.join(root, '.zeus/repository-graph-declarations.json'), 'utf8'),
  );
  altered.edges[0].provenance = 'inferred';
  write(root, '.zeus/repository-graph-declarations.json', `${JSON.stringify(altered, null, 2)}\n`);
  assert.throws(() => buildGraph(root, config), /declared edges only/);
});

test('name-status parser preserves rename source and target', () => {
  assert.deepEqual(parseNameStatusZ('R100\0old.ts\0new.ts\0M\0same.ts\0'), [
    { status: 'R100', old_path: 'old.ts', path: 'new.ts' },
    { status: 'M', path: 'same.ts' },
  ]);
});

test('invalid diff base fails closed instead of producing a false-low verification tier', () => {
  const { root, config } = makeRepo();
  const { nodes, edges } = graph(root, config);
  assert.throws(
    () => diffImpactFromGraph(root, nodes, edges, config, { base: 'definitely-missing-ref' }),
    /git diff .* failed/,
  );
});

test('rename/delete uncertainty and expected-scope expansion escalate verification', () => {
  const { root, config } = makeRepo();
  const base = git(root, 'rev-parse', 'HEAD');
  renameSync(
    path.join(root, 'packages/bim-core/src/index.ts'),
    path.join(root, 'packages/bim-core/src/model.ts'),
  );
  write(root, 'apps/web/src/other.ts', 'export const other = true;\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-m', 'rename and broader change');
  const { nodes, edges } = graph(root, config);
  const changes = collectDiff(root, base);
  assert(changes.some((item) => item.status.startsWith('R')));
  const result = diffImpactFromGraph(root, nodes, edges, config, {
    base,
    expectedPrefix: 'packages/bim-core',
  });
  assert.equal(result.uncertainty, true);
  assert.equal(result.scope_expansion, true);
  assert.equal(result.verification.level, 'protected');
});
