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
  let match;

  const declarationExport = new RegExp(
    `\\bexport\\s+(?:declare\\s+)?(?:default\\s+)?(?:async\\s+)?(?:const|let|var|function|class|interface|type|enum|namespace)\\s+(${IDENTIFIER})`,
    'g',
  );
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
      imports.push({
        source,
        imported: match[1],
        local: `${local}.${match[1]}`,
        kind: 'namespace-member',
      });
    }
  }

  return {
    exports: uniqueBy(exports, (item) => `${item.name}\0${item.kind}`),
    imports: uniqueBy(
      imports,
      (item) => `${item.source}\0${item.imported}\0${item.local}\0${item.kind}`,
    ),
    reexports: uniqueBy(reexports, (item) => `${item.source}\0${item.imported}\0${item.exported}`),
  };
}

function parseRustUsePart(prefix, part, isPublic) {
  const clean = part.trim();
  if (!clean) return null;
  if (clean === 'self') return { path: prefix, alias: null, public: isPublic, glob: false };
  const aliasMatch = /^(.*?)\s+as\s+([A-Za-z_][A-Za-z0-9_]*)$/.exec(clean);
  const pathPart = (aliasMatch ? aliasMatch[1] : clean).trim();
  const fullPath = prefix ? `${prefix}::${pathPart}` : pathPart;
  return {
    path: fullPath,
    alias: aliasMatch?.[2] || null,
    public: isPublic,
    glob: pathPart === '*',
  };
}

function rustUseEntries(raw, isPublic) {
  const clean = raw.replace(/\s+/g, ' ').trim();
  const group = /^(.*?)::\s*{([^}]+)}$/.exec(clean);
  if (group) {
    const prefix = group[1].trim();
    return splitNamedList(group[2])
      .map((part) => parseRustUsePart(prefix, part, isPublic))
      .filter(Boolean);
  }
  return [parseRustUsePart('', clean, isPublic)].filter(Boolean);
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

  const moduleDecl = new RegExp(`\\b(pub\\s+)?mod\\s+(${RUST_IDENTIFIER})\\s*;`, 'g');
  while ((match = moduleDecl.exec(text)) !== null) {
    modules.push({ name: match[2], public: Boolean(match[1]) });
  }

  const useDecl = /\b(pub\s+)?use\s+([^;]+);/g;
  while ((match = useDecl.exec(text)) !== null) {
    uses.push(...rustUseEntries(match[2], Boolean(match[1])));
  }

  const wasm = new RegExp(
    `#\\s*\\[\\s*wasm_bindgen\\s*\\(\\s*js_name\\s*=\\s*(${RUST_IDENTIFIER})\\s*\\)\\s*]\\s*(?:#[^\\n]*\\n\\s*)*pub\\s+(?:async\\s+)?fn\\s+(${RUST_IDENTIFIER})`,
    'g',
  );
  while ((match = wasm.exec(text)) !== null) {
    wasmExports.push({ jsName: match[1], rustName: match[2] });
  }

  return {
    exports: uniqueBy(exports, (item) => item.name),
    modules: uniqueBy(modules, (item) => `${item.name}\0${item.public}`),
    uses: uniqueBy(
      uses,
      (item) => `${item.path}\0${item.alias || ''}\0${item.public}\0${item.glob}`,
    ),
    wasmExports: uniqueBy(wasmExports, (item) => `${item.jsName}\0${item.rustName}`),
  };
}

function sourceModuleParts(sourceRel) {
  const normalized = sourceRel.replaceAll('\\', '/');
  const parts = normalized.split('/');
  const srcIndex = parts.lastIndexOf('src');
  if (srcIndex < 0 || !normalized.endsWith('.rs')) return null;
  const crateRoot = parts.slice(0, srcIndex + 1).join('/');
  const afterSrc = parts.slice(srcIndex + 1);
  const fileName = afterSrc.at(-1);
  const dirs = afterSrc.slice(0, -1);
  if (fileName === 'lib.rs' || fileName === 'main.rs') return { crateRoot, moduleParts: [] };
  if (fileName === 'mod.rs') return { crateRoot, moduleParts: dirs };
  return { crateRoot, moduleParts: [...dirs, fileName.replace(/\.rs$/, '')] };
}

function moduleFileCandidates(crateRoot, moduleParts) {
  if (moduleParts.length === 0) return [`${crateRoot}/lib.rs`, `${crateRoot}/main.rs`];
  const base = `${crateRoot}/${moduleParts.join('/')}`;
  return [`${base}.rs`, `${base}/mod.rs`];
}

export function rustDependencyCandidates(sourceRel, rustPath) {
  const source = sourceModuleParts(sourceRel);
  if (!source) return [];
  let remaining = rustPath.replace(/^::/, '').split('::').filter(Boolean);
  let baseParts;

  if (remaining[0] === 'crate') {
    remaining = remaining.slice(1);
    baseParts = [];
  } else if (remaining[0] === 'self') {
    remaining = remaining.slice(1);
    baseParts = [...source.moduleParts];
  } else {
    baseParts = [...source.moduleParts];
    while (remaining[0] === 'super') {
      remaining = remaining.slice(1);
      baseParts.pop();
    }
  }

  if (remaining[0] === '*') remaining = remaining.slice(1);
  const candidates = [];
  for (let length = remaining.length; length >= 0; length -= 1) {
    candidates.push(...moduleFileCandidates(source.crateRoot, [...baseParts, ...remaining.slice(0, length)]));
  }
  return [...new Set(candidates)];
}

export function localRustModuleCandidates(sourceRel, moduleName) {
  const source = sourceModuleParts(sourceRel);
  if (!source) return [];
  return moduleFileCandidates(source.crateRoot, [...source.moduleParts, moduleName]);
}

export function wasmBridgeImports(text, knownJsNames, moduleHints) {
  const names = new Set(knownJsNames);
  const hints = (moduleHints || []).map((hint) => String(hint).toLowerCase());
  return typescriptFacts(text).imports
    .filter((item) => item.imported !== '*' && item.imported !== 'default')
    .filter((item) => names.has(item.imported))
    .filter((item) => {
      const source = item.source.toLowerCase();
      return hints.some((hint) => source.includes(hint));
    })
    .map((item) => ({
      source: item.source,
      jsName: item.imported,
      local: item.local,
      kind: item.kind,
    }));
}
