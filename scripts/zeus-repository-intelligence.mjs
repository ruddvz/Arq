#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_CONFIG = '.zeus/repository-graph.json';
const CONSUMER_RELATIONS = new Set([
  'ACTS_ON',
  'DEPENDS_ON',
  'GENERATED_FROM',
  'MEMBER_OF',
  'PERSISTS',
  'RENDERS',
  'TESTS',
  'VALIDATES',
]);
const DERIVED_AUTHORITIES = new Set(['derived', 'interface', 'adapter', 'verification', 'harness']);

export function runGit(root, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(
      `git ${args.join(' ')} failed: ${(result.stderr || result.stdout || '').trim()}`,
    );
  }
  return result.status === 0 ? result.stdout : '';
}

function normalize(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}

export function loadConfig(root, configPath = DEFAULT_CONFIG) {
  const full = path.join(root, configPath);
  const config = JSON.parse(readFileSync(full, 'utf8'));
  if (config.protocol !== 'zeus-repository-intelligence/v1') {
    throw new Error(`unsupported repository graph protocol: ${config.protocol}`);
  }
  const hard = new Set(config.hard_gate_provenance || []);
  for (const provenance of hard) {
    if (!['deterministic', 'declared'].includes(provenance)) {
      throw new Error('hard_gate_provenance may contain deterministic/declared only');
    }
  }
  return config;
}

export function gitDir(root) {
  const raw = runGit(root, ['rev-parse', '--git-dir']).trim();
  return path.isAbsolute(raw) ? raw : path.resolve(root, raw);
}

export function cachePath(root) {
  return path.join(gitDir(root), 'zeus-repository-intelligence', 'graph.json');
}

function isExcluded(rel, config) {
  const clean = normalize(rel);
  if (
    (config.exclude_prefixes || []).some(
      (prefix) => clean === normalize(prefix) || clean.startsWith(`${normalize(prefix)}/`),
    )
  ) {
    return true;
  }
  const generatedSegments = new Set([
    'node_modules',
    '.turbo',
    'coverage',
    'dist',
    'build',
    'out',
    'target',
  ]);
  return clean.split('/').some((segment) => generatedSegments.has(segment));
}

function isSourceFile(rel, config) {
  if (isExcluded(rel, config)) return false;
  const extension = path.posix.extname(rel).toLowerCase();
  return (config.source_extensions || []).includes(extension);
}

export function listSourceFiles(root, config) {
  const raw = runGit(root, ['ls-files', '--cached', '--others', '--exclude-standard', '-z']);
  return [...new Set(raw.split('\0').filter(Boolean).map(normalize))]
    .filter((rel) => isSourceFile(rel, config))
    .filter((rel) => existsSync(path.join(root, rel)) && statSync(path.join(root, rel)).isFile())
    .sort();
}

export function sourceStateDigest(root, config) {
  const hash = createHash('sha256');
  for (const rel of listSourceFiles(root, config)) {
    hash.update(rel);
    hash.update('\0');
    hash.update(readFileSync(path.join(root, rel)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function declarationDigest(root, config, configPath = DEFAULT_CONFIG) {
  const hash = createHash('sha256');
  const files = [configPath, ...(config.declarations || [])].map(normalize).sort();
  for (const rel of files) {
    hash.update(rel);
    hash.update('\0');
    const full = path.join(root, rel);
    hash.update(existsSync(full) ? readFileSync(full) : Buffer.from('<missing>'));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function fingerprint(config, metadata) {
  const payload = JSON.stringify({
    protocol: config.protocol,
    schema_version: config.schema_version,
    extractor_version: config.extractor_version,
    source_revision: metadata.source_revision,
    branch: metadata.branch,
    source_state_digest: metadata.source_state_digest,
    declaration_digest: metadata.declaration_digest,
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function classifyPath(rel) {
  const clean = normalize(rel);
  const lower = clean.toLowerCase();
  const basename = path.posix.basename(lower);
  const isTest =
    lower.startsWith('tests/') ||
    lower.includes('/tests/') ||
    basename.includes('.test.') ||
    basename.includes('.spec.') ||
    basename.startsWith('test-') ||
    basename.startsWith('test_');
  if (isTest) return { domain: 'test', authority: 'verification', protected: false };
  if (lower.startsWith('.zeus/') || lower.startsWith('scripts/zeus')) {
    return { domain: 'harness', authority: 'harness', protected: false };
  }
  if (lower.startsWith('contracts/') || lower.includes('/schema') || basename.includes('schema')) {
    return { domain: 'contract', authority: 'contract', protected: true };
  }
  if (lower.startsWith('packages/bim-core/')) {
    return { domain: 'semantic_model', authority: 'canonical', protected: true };
  }
  if (lower.startsWith('packages/operations/')) {
    const ai = /(^|[\/_-])(ai|proposal|automation)([\/_-]|$)/.test(lower);
    return { domain: ai ? 'ai_operations' : 'operations', authority: 'operation', protected: true };
  }
  if (
    lower.startsWith('packages/arqfs/') ||
    lower.startsWith('packages/project-format/') ||
    lower.startsWith('packages/local-storage/')
  ) {
    return { domain: 'persistence', authority: 'persistence-contract', protected: true };
  }
  if (
    lower.startsWith('packages/geometry-2d/') ||
    lower.startsWith('packages/geometry-3d/') ||
    lower.startsWith('packages/geometry-occt/') ||
    lower.startsWith('rust/arq-core/') ||
    lower.includes('/canonical-unit') ||
    lower.includes('/unit-') ||
    lower.includes('/tolerance')
  ) {
    return { domain: 'geometry_units', authority: 'deterministic-core', protected: true };
  }
  if (lower.startsWith('packages/plan-renderer/') || lower.startsWith('packages/model-renderer/')) {
    return { domain: 'renderer', authority: 'derived', protected: false };
  }
  if (lower.startsWith('packages/derived-cache/')) {
    return { domain: 'derived_cache', authority: 'derived', protected: false };
  }
  if (
    lower.startsWith('packages/validation/') ||
    /^scripts\/(validate|verify|check)-/.test(lower)
  ) {
    return { domain: 'validation', authority: 'verification', protected: false };
  }
  if (lower.startsWith('apps/web/')) {
    return { domain: 'ui_app', authority: 'interface', protected: false };
  }
  if (lower.startsWith('apps/marketing/') || lower.startsWith('site/')) {
    return { domain: 'public_site', authority: 'interface', protected: false };
  }
  if (
    /^packages\/[^/]*-adapter\//.test(lower) ||
    lower.startsWith('packages/pdf-export/') ||
    lower.startsWith('packages/file-ingress/')
  ) {
    return { domain: 'adapter', authority: 'adapter', protected: false };
  }
  return { domain: 'ordinary_code', authority: 'code', protected: false };
}

function node(id, kind, label, rel, classification, metadata = {}) {
  return {
    id,
    kind,
    label,
    path: rel || null,
    domain: classification.domain,
    authority: classification.authority,
    protected: Boolean(classification.protected),
    metadata,
  };
}

function fileNodeId(rel) {
  return `file:${normalize(rel)}`;
}

function packageNodeId(packagePath) {
  return `package:${normalize(packagePath)}`;
}

function packageRoots(files) {
  const roots = new Set();
  for (const rel of files) {
    const match = rel.match(/^(packages\/[^/]+)\//);
    if (match) roots.add(match[1]);
    if (rel.startsWith('rust/arq-core/')) roots.add('rust/arq-core');
  }
  return [...roots].sort();
}

function packageMetadata(root, packagePath) {
  const aliases = [packagePath, path.posix.basename(packagePath)];
  const packageJson = path.join(root, packagePath, 'package.json');
  if (existsSync(packageJson)) {
    try {
      const parsed = JSON.parse(readFileSync(packageJson, 'utf8'));
      if (parsed.name) aliases.push(parsed.name);
    } catch {
      // Invalid package metadata belongs to existing repository validation.
    }
  }
  return { aliases: [...new Set(aliases)] };
}

function importSpecs(text) {
  const specs = [];
  const pattern =
    /(?:import\s+(?:type\s+)?(?:[^'"\n]*?\s+from\s+)?|export\s+(?:type\s+)?(?:[^'"\n]*?\s+from\s+)|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
  let match;
  while ((match = pattern.exec(text)) !== null) specs.push(match[1]);
  return [...new Set(specs)];
}

function candidateFiles(spec, sourceRel) {
  if (!spec.startsWith('.')) return [];
  const base = normalize(path.posix.join(path.posix.dirname(sourceRel), spec));
  const extension = path.posix.extname(base);
  if (extension) return [base];
  const suffixes = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
  return [
    base,
    ...suffixes.map((suffix) => `${base}${suffix}`),
    ...suffixes.map((suffix) => `${base}/index${suffix}`),
  ];
}

function loadDeclarations(root, config) {
  const edges = [];
  for (const rel of config.declarations || []) {
    const full = path.join(root, rel);
    if (!existsSync(full)) throw new Error(`missing declaration file: ${rel}`);
    const parsed = JSON.parse(readFileSync(full, 'utf8'));
    if (parsed.protocol !== config.protocol)
      throw new Error(`declaration protocol mismatch: ${rel}`);
    for (const item of parsed.edges || []) {
      if (item.provenance !== 'declared') {
        throw new Error('repository graph declarations may contain declared edges only');
      }
      edges.push({
        source: item.source,
        target: item.target,
        relation: item.relation,
        provenance: 'declared',
        authority: item.authority || 'zeus-declaration',
        source_ref: rel,
        extractor: 'declaration-loader',
        confidence: 1,
      });
    }
  }
  return edges;
}

export function buildGraph(root, config) {
  const files = listSourceFiles(root, config);
  const nodes = new Map();
  const edges = [];
  const fileSet = new Set(files);
  const workspaceNames = new Map();

  for (const packagePath of packageRoots(files)) {
    const classification = classifyPath(`${packagePath}/__package__.ts`);
    const metadata = packageMetadata(root, packagePath);
    const id = packageNodeId(packagePath);
    nodes.set(
      id,
      node(
        id,
        'package',
        path.posix.basename(packagePath),
        `${packagePath}/`,
        classification,
        metadata,
      ),
    );
    for (const alias of metadata.aliases) workspaceNames.set(alias, id);
  }

  for (const rel of files) {
    const classification = classifyPath(rel);
    const kind = classification.domain === 'test' ? 'test' : 'file';
    const id = fileNodeId(rel);
    nodes.set(id, node(id, kind, path.posix.basename(rel), rel, classification));
    const packageMatch =
      rel.match(/^(packages\/[^/]+)\//) ||
      (rel.startsWith('rust/arq-core/') ? ['', 'rust/arq-core'] : null);
    if (packageMatch) {
      const pkgId = packageNodeId(packageMatch[1]);
      if (nodes.has(pkgId)) {
        edges.push({
          source: id,
          target: pkgId,
          relation: 'MEMBER_OF',
          provenance: 'deterministic',
          authority: 'repository-layout',
          source_ref: rel,
          extractor: 'package-layout',
          confidence: 1,
        });
      }
    }
  }

  const importable = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
  for (const rel of files) {
    if (!importable.has(path.posix.extname(rel).toLowerCase())) continue;
    let text;
    try {
      if (statSync(path.join(root, rel)).size > 2_000_000) continue;
      text = readFileSync(path.join(root, rel), 'utf8');
    } catch {
      continue;
    }
    for (const spec of importSpecs(text)) {
      let targetId = null;
      if (spec.startsWith('.')) {
        const found = candidateFiles(spec, rel).find((candidate) => fileSet.has(candidate));
        if (found) targetId = fileNodeId(found);
      } else if (workspaceNames.has(spec)) {
        targetId = workspaceNames.get(spec);
      }
      if (!targetId || targetId === fileNodeId(rel)) continue;
      const sourceNode = nodes.get(fileNodeId(rel));
      edges.push({
        source: sourceNode.id,
        target: targetId,
        relation: sourceNode.domain === 'test' ? 'TESTS' : 'DEPENDS_ON',
        provenance: 'deterministic',
        authority: 'source-import',
        source_ref: rel,
        extractor: 'js-ts-import-extractor',
        confidence: 1,
      });
    }
  }

  for (const edge of loadDeclarations(root, config)) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) {
      throw new Error(`declared edge references missing node: ${edge.source} -> ${edge.target}`);
    }
    edges.push(edge);
  }

  const unique = new Map();
  for (const edge of edges) {
    const key = [edge.source, edge.target, edge.relation, edge.provenance].join('\0');
    if (!unique.has(key)) unique.set(key, edge);
  }
  return {
    nodes,
    edges: [...unique.values()].sort((a, b) =>
      `${a.source}\0${a.target}\0${a.relation}`.localeCompare(
        `${b.source}\0${b.target}\0${b.relation}`,
      ),
    ),
  };
}

function currentMetadata(root, config) {
  const source_revision = runGit(root, ['rev-parse', 'HEAD']).trim();
  const branch = runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']).trim() || 'HEAD';
  const source_state_digest = sourceStateDigest(root, config);
  const declaration_digest = declarationDigest(root, config);
  const metadata = {
    protocol: config.protocol,
    schema_version: String(config.schema_version),
    extractor_version: String(config.extractor_version),
    source_revision,
    branch,
    source_state_digest,
    declaration_digest,
    worktree_git_dir: gitDir(root),
  };
  metadata.fingerprint = fingerprint(config, metadata);
  return metadata;
}

export function writeSnapshot(root, config) {
  const graph = buildGraph(root, config);
  const metadata = {
    ...currentMetadata(root, config),
    generated_at: new Date().toISOString(),
  };
  const output = cachePath(root);
  mkdirSync(path.dirname(output), { recursive: true });
  const payload = {
    metadata,
    nodes: [...graph.nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: graph.edges,
  };
  writeFileSync(output, `${JSON.stringify(payload, null, 2)}\n`);
  return {
    ...metadata,
    cache: output,
    nodes: payload.nodes.length,
    edges: payload.edges.length,
  };
}

export function readSnapshot(root) {
  const file = cachePath(root);
  if (!existsSync(file)) throw new Error('repository graph cache missing; run build');
  const parsed = JSON.parse(readFileSync(file, 'utf8'));
  return {
    metadata: parsed.metadata,
    nodes: new Map((parsed.nodes || []).map((item) => [item.id, item])),
    edges: parsed.edges || [],
  };
}

export function graphStatus(root, config) {
  const current = currentMetadata(root, config);
  const file = cachePath(root);
  if (!existsSync(file)) return { ...current, cache: file, fresh: false, reason: 'cache-missing' };
  const snapshot = readSnapshot(root).metadata;
  const checks = {};
  for (const key of [
    'source_revision',
    'branch',
    'source_state_digest',
    'declaration_digest',
    'fingerprint',
  ]) {
    checks[key] = snapshot[key] === current[key];
  }
  const fresh = Object.values(checks).every(Boolean);
  return {
    ...current,
    cache: file,
    fresh,
    reason: fresh ? 'fresh' : 'fingerprint-mismatch',
    checks,
    snapshot,
  };
}

function requireFresh(root, config) {
  const status = graphStatus(root, config);
  if (!status.fresh) throw new Error(`repository graph is stale: ${status.reason}; run build`);
  return readSnapshot(root);
}

export function resolveSeeds(nodes, seeds) {
  const resolved = [];
  const unresolved = [];
  const ambiguous = {};
  for (const raw of seeds) {
    const seed = normalize(String(raw).trim());
    if (nodes.has(seed)) {
      resolved.push(seed);
      continue;
    }
    if (nodes.has(`file:${seed}`)) {
      resolved.push(`file:${seed}`);
      continue;
    }
    if (nodes.has(`package:${seed}`)) {
      resolved.push(`package:${seed}`);
      continue;
    }
    const needle = seed.toLowerCase();
    const matches = new Set();
    for (const item of nodes.values()) {
      if (normalize(item.path || '').toLowerCase() === needle) matches.add(item.id);
      if (String(item.label || '').toLowerCase() === needle) matches.add(item.id);
      for (const alias of item.metadata?.aliases || []) {
        if (String(alias).toLowerCase() === needle) matches.add(item.id);
      }
    }
    if (matches.size === 1) resolved.push([...matches][0]);
    else if (matches.size > 1) ambiguous[raw] = [...matches].sort();
    else unresolved.push(raw);
  }
  return { resolved: [...new Set(resolved)], unresolved, ambiguous };
}

function adjacency(edges, undirected = false) {
  const map = new Map();
  const add = (from, to, edge) => {
    if (!map.has(from)) map.set(from, []);
    map.get(from).push([to, edge]);
  };
  for (const edge of edges) {
    add(edge.source, edge.target, edge);
    if (undirected) add(edge.target, edge.source, edge);
  }
  return map;
}

export function boundedContext(nodes, edges, seedIds, budgets) {
  const graph = adjacency(edges, true);
  const queue = seedIds.map((id) => [id, 0]);
  const seen = new Map();
  let truncated = false;
  while (queue.length) {
    const [id, depth] = queue.shift();
    if (!nodes.has(id) || seen.has(id)) continue;
    if (seen.size >= budgets.max_nodes) {
      truncated = true;
      break;
    }
    seen.set(id, depth);
    if (depth >= budgets.max_depth) continue;
    for (const [next] of graph.get(id) || []) {
      if (!seen.has(next)) queue.push([next, depth + 1]);
    }
  }
  let selected = [...seen.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([id, depth]) => ({ ...nodes.get(id), depth }));
  const makePayload = () => {
    const ids = new Set(selected.map((item) => item.id));
    return {
      nodes: selected,
      edges: edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
      truncated,
    };
  };
  let payload = makePayload();
  while (selected.length > 1 && JSON.stringify(payload).length > budgets.max_context_chars) {
    selected = selected.slice(0, -1);
    truncated = true;
    payload = makePayload();
  }
  return { ...payload, node_count: payload.nodes.length, edge_count: payload.edges.length };
}

export function impactSlice(nodes, edges, seedIds, { max_nodes, max_depth }) {
  const downstream = new Map();
  const add = (from, to, edge) => {
    if (!downstream.has(from)) downstream.set(from, []);
    downstream.get(from).push([to, edge]);
  };
  for (const edge of edges) {
    if (CONSUMER_RELATIONS.has(edge.relation)) add(edge.target, edge.source, edge);
  }
  const queue = seedIds.map((id) => [id, 0]);
  const seen = new Map();
  const traversed = [];
  let truncated = false;
  while (queue.length) {
    const [id, depth] = queue.shift();
    if (!nodes.has(id) || seen.has(id)) continue;
    if (seen.size >= max_nodes) {
      truncated = true;
      break;
    }
    seen.set(id, depth);
    if (depth >= max_depth) continue;
    for (const [next, edge] of downstream.get(id) || []) {
      traversed.push(edge);
      if (!seen.has(next)) queue.push([next, depth + 1]);
    }
  }
  const ids = new Set(seen.keys());
  return {
    nodes: [...seen.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([id, depth]) => ({ ...nodes.get(id), depth })),
    edges: traversed.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
    truncated,
    node_count: ids.size,
  };
}

export function verificationFrontier(items, config, { uncertain = false } = {}) {
  const domains = new Set(items.map((item) => item.domain));
  const protectedDomains = new Set(config.protected_domains || []);
  let level;
  if (uncertain || [...domains].some((domain) => protectedDomains.has(domain))) {
    level = 'protected';
  } else if ([...domains].every((domain) => ['harness', 'test', 'validation'].includes(domain))) {
    level = 'harness';
  } else if (
    [...domains].some((domain) => ['renderer', 'derived_cache', 'ui_app'].includes(domain))
  ) {
    level = 'renderer_ui';
  } else {
    level = 'public_adapter';
  }
  return {
    level,
    uncertain,
    domains: [...domains].sort(),
    commands: [...config.verification_frontiers[level]],
  };
}

function authorityWarnings(items) {
  const warnings = [];
  for (const item of items) {
    if (DERIVED_AUTHORITIES.has(item.authority) && item.protected) {
      warnings.push(`${item.id} is derived/interface authority but marked protected`);
    }
  }
  return warnings;
}

export function preflightFromGraph(nodes, edges, seeds, config) {
  const resolution = resolveSeeds(nodes, seeds);
  const uncertain =
    resolution.unresolved.length > 0 || Object.keys(resolution.ambiguous).length > 0;
  const context = boundedContext(nodes, edges, resolution.resolved, config.budgets);
  const impact = impactSlice(nodes, edges, resolution.resolved, config.budgets);
  const verification = verificationFrontier(
    impact.nodes.length ? impact.nodes : context.nodes,
    config,
    { uncertain },
  );
  return {
    seeds: resolution,
    uncertainty: uncertain,
    context,
    impact,
    verification,
    canonical_or_protected: context.nodes.filter(
      (item) =>
        item.protected ||
        [
          'canonical',
          'operation',
          'contract',
          'persistence-contract',
          'deterministic-core',
        ].includes(item.authority),
    ),
    derived_or_interface: context.nodes.filter((item) => DERIVED_AUTHORITIES.has(item.authority)),
    authority_warnings: authorityWarnings(context.nodes),
  };
}

export function parseNameStatusZ(raw) {
  const tokens = raw.split('\0').filter((value) => value !== '');
  const changes = [];
  for (let i = 0; i < tokens.length;) {
    const status = tokens[i++];
    if (/^[RC]/.test(status)) {
      const oldPath = normalize(tokens[i++] || '');
      const newPath = normalize(tokens[i++] || '');
      changes.push({ status, old_path: oldPath, path: newPath });
    } else {
      changes.push({ status, path: normalize(tokens[i++] || '') });
    }
  }
  return changes.filter((item) => item.path || item.old_path);
}

export function collectDiff(root, base = 'HEAD~1') {
  const groups = [];
  const committed = runGit(root, ['diff', '--name-status', '-M', '-z', `${base}...HEAD`]);
  if (committed) groups.push(...parseNameStatusZ(committed));
  const unstaged = runGit(root, ['diff', '--name-status', '-M', '-z'], { allowFailure: true });
  if (unstaged) groups.push(...parseNameStatusZ(unstaged));
  const staged = runGit(root, ['diff', '--cached', '--name-status', '-M', '-z'], {
    allowFailure: true,
  });
  if (staged) groups.push(...parseNameStatusZ(staged));
  const untracked = runGit(root, ['ls-files', '--others', '--exclude-standard', '-z'], {
    allowFailure: true,
  });
  for (const rel of untracked.split('\0').filter(Boolean))
    groups.push({ status: 'A?', path: normalize(rel) });
  const unique = new Map();
  for (const item of groups)
    unique.set(`${item.status}\0${item.old_path || ''}\0${item.path || ''}`, item);
  return [...unique.values()];
}

export function diffImpactFromGraph(
  root,
  nodes,
  edges,
  config,
  { base = 'HEAD~1', expectedPrefix = null } = {},
) {
  const changes = collectDiff(root, base);
  const seedIds = [];
  let uncertainty = false;
  let scopeExpansion = false;
  const prefix = expectedPrefix ? normalize(expectedPrefix) : null;
  for (const change of changes) {
    if (/^[DRC]/.test(change.status)) uncertainty = true;
    const candidates = [change.path, change.old_path].filter(Boolean);
    if (
      prefix &&
      candidates.some((candidate) => !(candidate === prefix || candidate.startsWith(`${prefix}/`)))
    ) {
      scopeExpansion = true;
      uncertainty = true;
    }
    const currentId = change.path ? fileNodeId(change.path) : null;
    if (currentId && nodes.has(currentId)) seedIds.push(currentId);
    else uncertainty = true;
  }
  const impact = impactSlice(nodes, edges, [...new Set(seedIds)], config.budgets);
  const verification = verificationFrontier(impact.nodes, config, { uncertain: uncertainty });
  return {
    base,
    expected_prefix: expectedPrefix,
    changes,
    seed_ids: [...new Set(seedIds)],
    uncertainty,
    scope_expansion: scopeExpansion,
    impact,
    verification,
  };
}

function printHuman(command, result) {
  if (command === 'build') {
    console.log(`ZEUS repository graph built: ${result.nodes} nodes, ${result.edges} edges`);
    console.log(`revision: ${result.source_revision}`);
    console.log(`cache: ${result.cache}`);
    return;
  }
  if (command === 'status') {
    console.log(`ZEUS repository graph: ${result.fresh ? 'fresh' : 'STALE'} (${result.reason})`);
    console.log(`revision: ${result.source_revision}`);
    return;
  }
  if (command === 'preflight' || command === 'diff-impact') {
    console.log(
      `ZEUS ${command}: verification=${result.verification.level} uncertainty=${Boolean(result.uncertainty)}`,
    );
    for (const verification of result.verification.commands) console.log(`  - ${verification}`);
    return;
  }
  console.log(`ZEUS ${command}: ${result.node_count ?? result.context?.node_count ?? 0} nodes`);
}

function optionValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? args[index + 1] : fallback;
}

export async function main(argv = process.argv.slice(2), root = process.cwd()) {
  const json = argv.includes('--json');
  const args = argv.filter((arg) => arg !== '--json');
  const command = args[0];
  const config = loadConfig(root);
  let result;

  if (command === 'build') {
    result = writeSnapshot(root, config);
  } else if (command === 'status') {
    result = graphStatus(root, config);
    if (!result.fresh) process.exitCode = 2;
  } else if (['context', 'impact', 'preflight'].includes(command)) {
    const snapshot = requireFresh(root, config);
    const seeds = args.slice(1).filter((arg) => !arg.startsWith('--'));
    if (!seeds.length) throw new Error(`${command} requires at least one seed`);
    const resolution = resolveSeeds(snapshot.nodes, seeds);
    if (command === 'context') {
      result = {
        seeds: resolution,
        ...boundedContext(snapshot.nodes, snapshot.edges, resolution.resolved, config.budgets),
      };
    } else if (command === 'impact') {
      result = {
        seeds: resolution,
        ...impactSlice(snapshot.nodes, snapshot.edges, resolution.resolved, config.budgets),
      };
    } else {
      result = preflightFromGraph(snapshot.nodes, snapshot.edges, seeds, config);
    }
  } else if (command === 'diff-impact') {
    const snapshot = requireFresh(root, config);
    const base = optionValue(args, '--base', 'HEAD~1');
    const expectedPrefix = optionValue(args, '--expected-prefix', null);
    result = diffImpactFromGraph(root, snapshot.nodes, snapshot.edges, config, {
      base,
      expectedPrefix,
    });
  } else {
    throw new Error(
      'usage: zeus-repository-intelligence.mjs [--json] build|status|context|impact|preflight|diff-impact',
    );
  }

  if (json) console.log(JSON.stringify(result, null, 2));
  else printHuman(command, result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`ZEUS repository intelligence failed: ${error.message}`);
    process.exitCode = 1;
  });
}
