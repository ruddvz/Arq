const IDENTIFIER = '[A-Za-z_$][A-Za-z0-9_$]*';
const RUST_IDENTIFIER = '[A-Za-z_][A-Za-z0-9_]*';

function uniqueBy(items, key) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const id = key(item);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

function splitNamedList(raw) {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/^type\s+/, '').trim());
}

function parseTsNamedBindings(raw) {
  return splitNamedList(raw)
    .map((part) => {
      const match = new RegExp(`^(${IDENTIFIER})(?:\\s+as\\s+(${IDENTIFIER}))?$`).exec(part);
      if (!match) return null;
      return { imported: match[1], local: match[2] || match[1] };
    })
    .filter(Boolean);
}

export function typescriptFacts(text) {
  const exports = [];
  const imports = [];
  const reexports = [];
  const namespaceImports = new Map();

  const declarationExport = new RegExp(
    `\\bexport\\s+(?:declare\\s+)?(?:default\\s+)?(?:async\\s+)?(?:const|let|var|function|class|interface|type|enum|namespace)\\s+(${IDENTIFIER})`,
    'g',
  );
  let match;
  while ((match = declarationExport.exec(text)) !== null) {
    exports.push({ name: match[1], kind: 'declared' });
  }

  const namedExport = /\bexport\s*{([^}]+)}\s*(?:from\s*['"]([^'"]+)['"])?/g;
  while ((match = namedExport.exec(text)) !== null) {
    const source = match[2] || null;
    for (const part of splitNamedList(match[1])) {
      const binding = new RegExp(`^(${IDENTIFIER})(?:\\s+as\\s+(${IDENTIFIER}))?$`).exec(part);
      if (!binding) continue;
      const imported = binding[1];
      const exported = binding[2] || imported;
      exports.push({ name: exported, kind: source ? 'reexport' : 'named' });
      if (source) reexports.push({ source, imported, exported });
    }
  }

  const namedImport = /\bimport\s+(?:type\s+)?{([^}]+)}\s+from\s*['"]([^'"]+)['"]/g;
  while ((match = namedImport.exec(text)) !== null) {
    for (const binding of parseTsNamedBindings(match[1])) {
      imports.push({ source: match[2], ...binding, kind: 'named' });
    }
  }

  const namespaceImport = new RegExp(
    `\\bimport\\s+\\*\\s+as\\s+(${IDENTIFIER})\\s+from\\s*['"]([^'"]+)['"]`,
    'g',
  );
  while ((match = namespaceImport.exec(text)) !== null) {
    namespaceImports.set(match[1], match[2]);
    imports.push({ source: match[2], imported: '*', local: match[1], kind: 'namespace' });
  }

  const defaultImport = new RegExp(
    `\\bimport\\s+(?!type\\b)(${IDENTIFIER})\\s+from\\s*['"]([^'"]+)['"]`,
    'g',
  );
  while ((match = defaultImport.exec(text)) !== null) {
    imports.push({ source: match[2], imported: 'default', local: match[1], kind: 'default' });
  }

  for (const [local, source] of namespaceImports) {
    const property = new RegExp(`\\b${local}\\s*\\.\\s*(${IDENTIFIER})\\b`, 'g');
    while ((match = property.exec(text)) !== null) {
      imports.push({ source, imported: match[1], local: `${local}.${match[1]}`, kind: 'namespace-member' });
    }
  }

  return {
    exports: uniqueBy(exports, (item) => `${item.name}\0${item.kind}`),
    imports: uniqueBy(
      imports,
      (item) => `${item.source}\0${item.imported}\0${item.local}\0${item.kind}`,
    ),
    reexports: uniqueBy(
      reexports,
      (item) => `${item.source}\0${item.imported}\0${item.exported}`,
    ),
  };
}

function rustUseEntries(raw) {
  const clean = raw.replace(/\s+/g, ' ').trim();
  const group = /^(.*?)::\s*{([^}]+)}$/.exec(clean);
  if (group) {
    const prefix = group[1].trim();
    return splitNamedList(group[2])
      .map((part) => part.replace(/\s+as\s+.*$/, '').trim())
      .filter((part) => part && part !== 'self')
      .map((name) => `${prefix}::${name}`);
  }
  return [clean.replace(/\s+as\s+.*$/, '').trim()].filter(Boolean);
}

export function rustFacts(text) {
  const exports = [];
  const modules = [];
  const uses = [];
  const wasmExports = [];
  let match;

  const publicItem = new RegExp(
    `\\bpub(?:\\([^)]*\\))?\\s+(?:async\\s+)?(?:unsafe\\s+)?(?:extern\\s+"[^"]+"\\s+)?(?:fn|struct|enum|trait|type|const|static)\\s+(${RUST_IDENTIFIER})`,
    'g',
  );
  while ((match = publicItem.exec(text)) !== null) {
    exports.push({ name: match[1], kind: 'declared' });
  }

  const moduleDecl = new RegExp(`\\b(?:pub\\s+)?mod\\s+(${RUST_IDENTIFIER})\\s*;`, 'g');
  while ((match = moduleDecl.exec(text)) !== null) modules.push(match[1]);

  const useDecl = /\buse\s+([^;]+);/g;
  while ((match = useDecl.exec(text)) !== null) uses.push(...rustUseEntries(match[1]));

  const wasm = new RegExp(
    `#\\s*\\[\\s*wasm_bindgen\\s*\\(\\s*js_name\\s*=\\s*(${RUST_IDENTIFIER})\\s*\\)\\s*]\\s*(?:#[^\\n]*\\n\\s*)*pub\\s+fn\\s+(${RUST_IDENTIFIER})`,
    'g',
  );
  while ((match = wasm.exec(text)) !== null) {
    wasmExports.push({ jsName: match[1], rustName: match[2] });
  }

  return {
    exports: uniqueBy(exports, (item) => item.name),
    modules: [...new Set(modules)],
    uses: [...new Set(uses)],
    wasmExports: uniqueBy(wasmExports, (item) => `${item.jsName}\0${item.rustName}`),
  };
}

export function rustModuleCandidates(sourceRel, rustPath) {
  const normalized = rustPath.replace(/^::/, '').replace(/::[^:]+$/, '');
  const sourceParts = sourceRel.replaceAll('\\', '/').split('/');
  const srcIndex = sourceParts.lastIndexOf('src');
  if (srcIndex < 0 || !sourceRel.endsWith('.rs')) return [];
  const crateRoot = sourceParts.slice(0, srcIndex + 1).join('/');
  const sourceDir = sourceParts.slice(0, -1).join('/');

  let moduleParts;
  if (normalized === 'crate') moduleParts = [];
  else if (normalized.startsWith('crate::')) moduleParts = normalized.slice(7).split('::');
  else if (normalized.startsWith('self::')) moduleParts = normalized.slice(6).split('::');
  else if (normalized.startsWith('super::')) {
    let rest = normalized;
    let dir = sourceDir;
    while (rest.startsWith('super::')) {
      dir = dir.slice(0, Math.max(0, dir.lastIndexOf('/')));
      rest = rest.slice(7);
    }
    const base = rest ? `${dir}/${rest.split('::').join('/')}` : dir;
    return [`${base}.rs`, `${base}/mod.rs`];
  } else {
    moduleParts = normalized.split('::');
  }

  const baseDir = normalized.startsWith('self::') ? sourceDir : crateRoot;
  const base = moduleParts.length ? `${baseDir}/${moduleParts.join('/')}` : `${crateRoot}/lib`;
  return [`${base}.rs`, `${base}/mod.rs`];
}

export function localRustModuleCandidates(sourceRel, moduleName) {
  const dir = sourceRel.replaceAll('\\', '/').replace(/\/[^/]+$/, '');
  return [`${dir}/${moduleName}.rs`, `${dir}/${moduleName}/mod.rs`];
}

export function wasmBridgeMemberReferences(text, knownJsNames) {
  if (!/(?:arq[_-]core|rust\/arq-core|wasm)/i.test(text)) return [];
  const found = [];
  for (const name of knownJsNames) {
    const pattern = new RegExp(`(?:\\.|\\b)${name}\\s*\\(`);
    if (pattern.test(text)) found.push(name);
  }
  return found.sort();
}
