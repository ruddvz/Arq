import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const MAX_SOURCE_BYTES = 2_000_000;

function normalize(value) {
  return String(value).replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}
function fileNodeId(rel) {
  return `file:${normalize(rel)}`;
}
function packageNodeId(packagePath) {
  return `package:${normalize(packagePath)}`;
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
function addEdge(edges, edge) {
  if (!edge.source || !edge.target || edge.source === edge.target) return;
  edges.push({ provenance: 'deterministic', confidence: 1, ...edge });
}
function packageRootForFile(rel) {
  const clean = normalize(rel);
  const match = clean.match(/^(rust\/[^/]+)\//);
  return match ? match[1] : null;
}
function cargoMetadata(root, packagePath) {
  const text = readSmallText(root, `${packagePath}/Cargo.toml`);
  if (!text) return null;
  const packageSection = text.match(/\[package\]([\s\S]*?)(?=\n\s*\[|$)/)?.[1] ?? '';
  const libSection = text.match(/\[lib\]([\s\S]*?)(?=\n\s*\[|$)/)?.[1] ?? '';
  const name = packageSection.match(/^\s*name\s*=\s*["']([^"']+)["']/m)?.[1] ?? null;
  const crateTypeBody = libSection.match(/^\s*crate-type\s*=\s*\[([^\]]*)\]/m)?.[1] ?? '';
  const crateTypes = [...crateTypeBody.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
  const wasmBindgen = /^\s*wasm-bindgen(?:\s*=|\s*\.)/m.test(text);
  return { name, crate_types: crateTypes, wasm_bindgen: wasmBindgen };
}
function rustModuleRefs(text) {
  const refs = new Set();
  for (const match of text.matchAll(/\b(?:pub\s+)?use\s+crate::([A-Za-z_][A-Za-z0-9_]*)/g)) refs.add(match[1]);
  for (const match of text.matchAll(/\b(?:pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)) refs.add(match[1]);
  for (const match of text.matchAll(/\b(?:pub\s+)?use\s+crate::\{([^}]+)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)/)?.[1];
      if (name) refs.add(name);
    }
  }
  return [...refs];
}
function rustModuleFile(packagePath, moduleName, fileSet) {
  return [`${packagePath}/src/${moduleName}.rs`, `${packagePath}/src/${moduleName}/mod.rs`].find((candidate) => fileSet.has(candidate));
}

export function augmentRustGraph(root, files, fileSet, nodes, edges, classifyPath) {
  const rustRoots = new Set(files.map(packageRootForFile).filter(Boolean));
  for (const packagePath of [...rustRoots].sort()) {
    const id = packageNodeId(packagePath);
    const cargo = cargoMetadata(root, packagePath);
    const aliases = [packagePath, path.posix.basename(packagePath), cargo?.name].filter(Boolean);
    if (!nodes.has(id)) {
      const classification = classifyPath(`${packagePath}/src/lib.rs`);
      nodes.set(id, {
        id,
        kind: 'package',
        label: cargo?.name || path.posix.basename(packagePath),
        path: `${packagePath}/`,
        domain: classification.domain,
        authority: classification.authority,
        protected: Boolean(classification.protected),
        metadata: { aliases: [...new Set(aliases)], cargo },
      });
    } else {
      const current = nodes.get(id);
      nodes.set(id, {
        ...current,
        metadata: {
          ...(current.metadata || {}),
          aliases: [...new Set([...(current.metadata?.aliases || []), ...aliases])],
          ...(cargo ? { cargo } : {}),
        },
      });
    }
    for (const rel of files) {
      if (!rel.startsWith(`${packagePath}/`) || !nodes.has(fileNodeId(rel))) continue;
      addEdge(edges, {
        source: fileNodeId(rel),
        target: id,
        relation: 'MEMBER_OF',
        authority: 'repository-layout',
        source_ref: rel,
        extractor: 'cross-language-package-layout',
      });
    }
  }

  for (const rel of files) {
    if (path.posix.extname(rel).toLowerCase() !== '.rs') continue;
    const packagePath = packageRootForFile(rel);
    if (!packagePath) continue;
    const text = readSmallText(root, rel);
    if (!text) continue;
    for (const moduleName of rustModuleRefs(text)) {
      const target = rustModuleFile(packagePath, moduleName, fileSet);
      if (!target) continue;
      addEdge(edges, {
        source: fileNodeId(rel),
        target: fileNodeId(target),
        relation: 'DEPENDS_ON',
        authority: 'rust-module-reference',
        source_ref: rel,
        extractor: 'rust-module-extractor',
      });
    }
    const cargo = cargoMetadata(root, packagePath);
    const isWasmSurface = cargo?.wasm_bindgen && cargo.crate_types.includes('cdylib') && /#\s*\[\s*wasm_bindgen(?:\s*\(|\s*\])/.test(text);
    if (isWasmSurface) {
      addEdge(edges, {
        source: packageNodeId(packagePath),
        target: fileNodeId(rel),
        relation: 'GENERATED_FROM',
        authority: 'wasm-bindgen-interface',
        source_ref: rel,
        extractor: 'rust-wasm-interface-extractor',
      });
    }
  }
}
