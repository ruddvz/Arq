#!/usr/bin/env node

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  buildGraph as buildBaseGraph,
  cachePath,
  classifyPath,
  listSourceFiles,
  loadConfig,
  main as baseMain,
  writeSnapshot as writeBaseSnapshot,
} from './zeus-repository-intelligence.mjs';
import { augmentRustGraph } from './lib/zeus-rust-graph.mjs';
import { augmentTsAliasGraph } from './lib/zeus-ts-alias-graph.mjs';

export * from './zeus-repository-intelligence.mjs';

const MAX_SOURCE_BYTES = 2_000_000;
const MODULE_SUFFIXES = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];

function normalize(value) {
  return String(value).replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}
function fileNodeId(rel) {
  return `file:${normalize(rel)}`;
}
function readSmallText(root, rel) {
  const full = path.join(root, rel);
  try {
    if (!existsSync(full) || statSync(full).size > MAX_SOURCE_BYTES) return null;
    return readFileSync(full, 'utf8');
  } catch {
    return null;
  }
}
function moduleCandidates(base) {
  const clean = normalize(base);
  if (path.posix.extname(clean)) return [clean];
  return [clean, ...MODULE_SUFFIXES.map((suffix) => `${clean}${suffix}`), ...MODULE_SUFFIXES.map((suffix) => `${clean}/index${suffix}`)];
}
function manifestEntrypoints(root, packagePath) {
  const text = readSmallText(root, `${packagePath}/package.json`);
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    const values = new Set();
    const collect = (value) => {
      if (typeof value === 'string') values.add(value);
      else if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === 'object') Object.values(value).forEach(collect);
    };
    collect(parsed.exports);
    for (const key of ['source', 'types', 'module', 'main']) collect(parsed[key]);
    return [...values];
  } catch {
    return [];
  }
}
function packageSurfaceCandidates(root, packagePath) {
  const candidates = new Set();
  if (packagePath.startsWith('rust/')) candidates.add(`${packagePath}/src/lib.rs`);
  for (const raw of manifestEntrypoints(root, packagePath)) {
    if (!raw || raw.startsWith('#')) continue;
    const clean = normalize(raw.replace(/^\.\//, ''));
    for (const candidate of moduleCandidates(`${packagePath}/${clean}`)) candidates.add(candidate);
  }
  for (const candidate of moduleCandidates(`${packagePath}/src/index`)) candidates.add(candidate);
  return [...candidates];
}
function addPackageSurfaceEdges(root, fileSet, nodes, edges) {
  for (const item of nodes.values()) {
    if (item.kind !== 'package' || !item.path) continue;
    const packagePath = normalize(item.path);
    for (const rel of packageSurfaceCandidates(root, packagePath)) {
      if (!fileSet.has(rel)) continue;
      edges.push({
        source: item.id,
        target: fileNodeId(rel),
        relation: 'GENERATED_FROM',
        provenance: 'deterministic',
        authority: packagePath.startsWith('rust/') ? 'rust-crate-surface' : 'package-entrypoint',
        source_ref: rel,
        extractor: 'package-surface-extractor',
        confidence: 1,
      });
    }
  }
}
function addPackageDependencyEdges(root, fileSet, nodes, edges) {
  const existing = [...edges];
  for (const item of nodes.values()) {
    if (item.kind !== 'package' || !item.path) continue;
    const packagePath = normalize(item.path);
    const entryIds = new Set(packageSurfaceCandidates(root, packagePath).filter((candidate) => fileSet.has(candidate)).map(fileNodeId));
    for (const edge of existing) {
      if (!entryIds.has(edge.source) || !['DEPENDS_ON', 'GENERATED_FROM'].includes(edge.relation)) continue;
      edges.push({
        source: item.id,
        target: edge.target,
        relation: 'DEPENDS_ON',
        provenance: 'deterministic',
        authority: 'package-entrypoint-dependency',
        source_ref: edge.source_ref || packagePath,
        extractor: 'package-surface-extractor',
        confidence: 1,
      });
    }
  }
}
function uniqueEdges(edges) {
  const unique = new Map();
  for (const edge of edges) {
    const key = [edge.source, edge.target, edge.relation, edge.provenance].join('\0');
    if (!unique.has(key)) unique.set(key, edge);
  }
  return [...unique.values()].sort((a, b) => `${a.source}\0${a.target}\0${a.relation}`.localeCompare(`${b.source}\0${b.target}\0${b.relation}`));
}

export function augmentGraph(root, config, baseGraph = buildBaseGraph(root, config)) {
  const files = listSourceFiles(root, config);
  const fileSet = new Set(files);
  const nodes = new Map(baseGraph.nodes);
  const edges = [...baseGraph.edges];
  augmentRustGraph(root, files, fileSet, nodes, edges, classifyPath);
  augmentTsAliasGraph(root, files, fileSet, nodes, edges);
  addPackageSurfaceEdges(root, fileSet, nodes, edges);
  addPackageDependencyEdges(root, fileSet, nodes, edges);
  return { nodes, edges: uniqueEdges(edges) };
}

export function buildGraph(root, config) {
  return augmentGraph(root, config, buildBaseGraph(root, config));
}

export function writeSnapshot(root, config) {
  const base = writeBaseSnapshot(root, config);
  const graph = buildGraph(root, config);
  const snapshotPath = cachePath(root);
  const payload = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  payload.nodes = [...graph.nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
  payload.edges = graph.edges;
  writeFileSync(snapshotPath, `${JSON.stringify(payload, null, 2)}\n`);
  return { ...base, nodes: payload.nodes.length, edges: payload.edges.length };
}

export async function main(argv = process.argv.slice(2), root = process.cwd()) {
  const args = argv.filter((arg) => arg !== '--json');
  if (args[0] !== 'build') return baseMain(argv, root);
  const result = writeSnapshot(root, loadConfig(root));
  if (argv.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`ZEUS repository graph built: ${result.nodes} nodes, ${result.edges} edges`);
    console.log(`revision: ${result.source_revision}`);
    console.log(`cache: ${result.cache}`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`ZEUS repository intelligence failed: ${error.message}`);
    process.exitCode = 1;
  });
}
