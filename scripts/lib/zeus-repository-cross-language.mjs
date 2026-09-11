import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  localRustModuleCandidates,
  rustFacts,
  rustUseModuleCandidates,
  typescriptFacts,
  wasmBridgeMemberReferences,
} from './zeus-repository-symbols.mjs';

const JS_TS_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);

function normalize(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function fileNodeId(rel) {
  return `file:${normalize(rel)}`;
}

function packageNodeId(rel) {
  return `package:${normalize(rel)}`;
}

function rustSymbolId(rel, name) {
  return `symbol:rust:${normalize(rel)}#${name}`;
}

function tsSymbolId(rel, name) {
  return `symbol:typescript:${normalize(rel)}#${name}`;
}

function wasmSymbolId(packagePath, name) {
  return `symbol:wasm:${normalize(packagePath)}#${name}`;
}

function referenceNodeId(language, rel, reference) {
  return `reference:${language}:${normalize(rel)}#${reference}`;
}

function makeNode(id, kind, label, rel, classification, metadata = {}) {
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

function deterministicEdge(source, target, relation, sourceRef, extractor, authority) {
  return {
    source,
    target,
    relation,
    provenance: 'deterministic',
    authority,
    source_ref: sourceRef,
    extractor,
    confidence: 1,
  };
}

function advisoryReference(nodes, edges, sourceId, language, rel, reference, classification) {
  const id = referenceNodeId(language, rel, reference);
  if (!nodes.has(id)) {
    nodes.set(
      id,
      makeNode(id, 'reference', reference, rel, {
        ...classification,
        authority: 'advisory',
        protected: false,
      }, {
        language,
        reference,
        unresolved: true,
        aliases: [reference],
      }),
    );
  }
  edges.push(
    deterministicEdge(
      sourceId,
      id,
      'DEPENDS_ON',
      rel,
      `${language}-unresolved-reference`,
      'advisory-reference',
    ),
  );
}

function readText(root, rel) {
  try {
    const full = path.join(root, rel);
    if (statSync(full).size > 2_000_000) return null;
    return readFileSync(full, 'utf8');
  } catch {
    return null;
  }
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

function cargoPackageMetadata(root, manifestRel) {
  const text = readText(root, manifestRel);
  if (!text) return null;
  const packageSection = /(?:^|\n)\s*\[package]\s*\n([\s\S]*?)(?=\n\s*\[|$)/.exec(text)?.[1];
  if (!packageSection) return null;
  const name = /^\s*name\s*=\s*['"]([^'"]+)['"]/m.exec(packageSection)?.[1];
  if (!name) return null;
  const dependencySections = [...text.matchAll(/(?:^|\n)\s*\[(?:target\.[^\]]+\.)?dependencies]\s*\n([\s\S]*?)(?=\n\s*\[|$)/g)];
  const dependencies = [];
  for (const match of dependencySections) {
    for (const line of match[1].split('\n')) {
      const dep = /^\s*([A-Za-z0-9_-]+)\s*=/.exec(line)?.[1];
      if (dep) dependencies.push(dep);
    }
  }
  return {
    name,
    dependencies: [...new Set(dependencies)].sort(),
  };
}

function addCargoPackages({ root, files, nodes, edges, classifyPath }) {
  const packages = [];
  for (const manifestRel of files.filter((rel) => rel.endsWith('/Cargo.toml'))) {
    const cargo = cargoPackageMetadata(root, manifestRel);
    if (!cargo) continue;
    const packagePath = path.posix.dirname(manifestRel);
    const id = packageNodeId(packagePath);
    const classification = classifyPath(`${packagePath}/src/lib.rs`);
    const aliases = [packagePath, path.posix.basename(packagePath), cargo.name, cargo.name.replaceAll('-', '_')];
    if (!nodes.has(id)) {
      nodes.set(
        id,
        makeNode(id, 'package', cargo.name, `${packagePath}/`, classification, {
          aliases: [...new Set(aliases)],
          language: 'rust',
          cargo_name: cargo.name,
          external_dependencies: cargo.dependencies,
        }),
      );
    } else {
      const current = nodes.get(id);
      nodes.set(id, {
        ...current,
        label: cargo.name,
        metadata: {
          ...(current.metadata || {}),
          aliases: [...new Set([...(current.metadata?.aliases || []), ...aliases])],
          language: 'rust',
          cargo_name: cargo.name,
          external_dependencies: cargo.dependencies,
        },
      });
    }
    for (const rel of files.filter((candidate) => candidate.startsWith(`${packagePath}/`))) {
      const fileId = fileNodeId(rel);
      if (nodes.has(fileId)) {
        edges.push(
          deterministicEdge(fileId, id, 'MEMBER_OF', rel, 'cargo-package-layout', 'cargo-layout'),
        );
      }
    }
    packages.push({ id, path: packagePath, ...cargo });
  }
  return packages;
}

function packageForFile(packages, rel) {
  return packages
    .filter((pkg) => rel === pkg.path || rel.startsWith(`${pkg.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0] || null;
}

function addRustFacts({ root, files, nodes, edges, fileSet, classifyPath, packages }) {
  const wasmExports = new Map();
  for (const rel of files.filter((candidate) => candidate.endsWith('.rs'))) {
    const text = readText(root, rel);
    if (text === null) continue;
    const sourceId = fileNodeId(rel);
    const classification = classifyPath(rel);
    const facts = rustFacts(text);
    const pkg = packageForFile(packages, rel);

    for (const item of facts.exports) {
      const id = rustSymbolId(rel, item.name);
      nodes.set(
        id,
        makeNode(id, 'symbol', item.name, rel, classification, {
          language: 'rust',
          symbol: item.name,
          aliases: [item.name],
        }),
      );
      edges.push(
        deterministicEdge(id, sourceId, 'MEMBER_OF', rel, 'rust-symbol-extractor', 'source-symbol'),
      );
    }

    for (const moduleName of facts.modules) {
      const target = localRustModuleCandidates(rel, moduleName).find((candidate) => fileSet.has(candidate));
      if (target) {
        edges.push(
          deterministicEdge(
            sourceId,
            fileNodeId(target),
            'DEPENDS_ON',
            rel,
            'rust-module-extractor',
            'source-import',
          ),
        );
      } else {
        advisoryReference(nodes, edges, sourceId, 'rust', rel, `mod ${moduleName}`, classification);
      }
    }

    for (const usePath of facts.uses) {
      if (!/^(?:crate|self|super)::/.test(usePath)) continue;
      const target = rustUseModuleCandidates(rel, usePath).find((candidate) => fileSet.has(candidate));
      if (target) {
        edges.push(
          deterministicEdge(
            sourceId,
            fileNodeId(target),
            'DEPENDS_ON',
            rel,
            'rust-use-extractor',
            'source-import',
          ),
        );
      } else {
        advisoryReference(nodes, edges, sourceId, 'rust', rel, usePath, classification);
      }
    }

    if (!pkg) continue;
    for (const item of facts.wasmExports) {
      const id = wasmSymbolId(pkg.path, item.jsName);
      const rustId = rustSymbolId(rel, item.rustName);
      nodes.set(
        id,
        makeNode(id, 'symbol', item.jsName, rel, classification, {
          language: 'wasm',
          js_name: item.jsName,
          rust_name: item.rustName,
          crate: pkg.name,
          aliases: [item.jsName, `${pkg.name}.${item.jsName}`],
        }),
      );
      edges.push(
        deterministicEdge(
          id,
          nodes.has(rustId) ? rustId : sourceId,
          'GENERATED_FROM',
          rel,
          'wasm-bindgen-export-extractor',
          'source-binding',
        ),
      );
      wasmExports.set(item.jsName, id);
    }
  }
  return wasmExports;
}

function addTypeScriptFacts({ root, files, nodes, edges, fileSet, classifyPath, wasmExports }) {
  const knownWasmNames = [...wasmExports.keys()];
  for (const rel of files.filter((candidate) => JS_TS_EXTENSIONS.has(path.posix.extname(candidate)))) {
    const text = readText(root, rel);
    if (text === null) continue;
    const sourceId = fileNodeId(rel);
    const classification = classifyPath(rel);
    const facts = typescriptFacts(text);

    for (const item of facts.exports) {
      const id = tsSymbolId(rel, item.name);
      if (!nodes.has(id)) {
        nodes.set(
          id,
          makeNode(id, 'symbol', item.name, rel, classification, {
            language: 'typescript',
            symbol: item.name,
            aliases: [item.name],
          }),
        );
        edges.push(
          deterministicEdge(id, sourceId, 'MEMBER_OF', rel, 'ts-symbol-extractor', 'source-symbol'),
        );
      }
    }

    for (const item of facts.reexports) {
      if (!item.source.startsWith('.')) continue;
      const targetRel = candidateFiles(item.source, rel).find((candidate) => fileSet.has(candidate));
      if (!targetRel) {
        advisoryReference(
          nodes,
          edges,
          tsSymbolId(rel, item.exported),
          'typescript',
          rel,
          `${item.source}#${item.imported}`,
          classification,
        );
        continue;
      }
      const targetSymbol = tsSymbolId(targetRel, item.imported);
      const sourceSymbol = tsSymbolId(rel, item.exported);
      edges.push(
        deterministicEdge(
          sourceSymbol,
          nodes.has(targetSymbol) ? targetSymbol : fileNodeId(targetRel),
          'DEPENDS_ON',
          rel,
          'ts-reexport-extractor',
          'source-reexport',
        ),
      );
    }

    for (const name of wasmBridgeMemberReferences(text, knownWasmNames)) {
      edges.push(
        deterministicEdge(
          sourceId,
          wasmExports.get(name),
          classification.domain === 'test' ? 'TESTS' : 'DEPENDS_ON',
          rel,
          'wasm-bridge-reference-extractor',
          'source-binding',
        ),
      );
    }
  }
}

export function enrichCrossLanguageGraph({ root, files, nodes, edges, fileSet, classifyPath }) {
  const packages = addCargoPackages({ root, files, nodes, edges, classifyPath });
  const wasmExports = addRustFacts({
    root,
    files,
    nodes,
    edges,
    fileSet,
    classifyPath,
    packages,
  });
  addTypeScriptFacts({
    root,
    files,
    nodes,
    edges,
    fileSet,
    classifyPath,
    wasmExports,
  });
  return {
    rust_packages: packages.length,
    wasm_exports: wasmExports.size,
  };
}
