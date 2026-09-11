import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const MAX_SOURCE_BYTES = 2_000_000;
const JS_TS_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx']);
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
function importSpecs(text) {
  const specs = [];
  const pattern = /(?:import\s+(?:type\s+)?(?:[^'"\n]*?\s+from\s+)?|export\s+(?:type\s+)?(?:[^'"\n]*?\s+from\s+)|require\s*\(\s*|import\s*\(\s*)['"]([^'"]+)['"]/g;
  let match;
  while ((match = pattern.exec(text)) !== null) specs.push(match[1]);
  return [...new Set(specs)];
}
function parseJsonConfig(text) {
  return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/,\s*([}\]])/g, '$1'));
}
function loadMappings(root, files) {
  const mappings = [];
  for (const rel of files) {
    if (!/(^|\/)tsconfig(?:\.[^/]+)?\.json$/.test(rel)) continue;
    const text = readSmallText(root, rel);
    if (!text) continue;
    try {
      const parsed = parseJsonConfig(text);
      const paths = parsed.compilerOptions?.paths;
      if (!paths || typeof paths !== 'object') continue;
      const configDir = path.posix.dirname(rel);
      const baseUrl = normalize(path.posix.join(configDir, parsed.compilerOptions?.baseUrl || '.'));
      for (const [pattern, targets] of Object.entries(paths)) {
        if (!Array.isArray(targets)) continue;
        mappings.push({
          config_dir: configDir === '.' ? '' : normalize(configDir),
          base_url: baseUrl === '.' ? '' : baseUrl,
          pattern,
          targets: targets.filter((target) => typeof target === 'string'),
          source_ref: rel,
        });
      }
    } catch {
      // Invalid tsconfig syntax belongs to existing TypeScript validation.
    }
  }
  return mappings;
}
function aliasCapture(pattern, spec) {
  const star = pattern.indexOf('*');
  if (star < 0) return pattern === spec ? '' : null;
  const prefix = pattern.slice(0, star);
  const suffix = pattern.slice(star + 1);
  if (!spec.startsWith(prefix) || !spec.endsWith(suffix)) return null;
  return spec.slice(prefix.length, spec.length - suffix.length);
}
function aliasTargets(mapping, spec, fileSet) {
  const capture = aliasCapture(mapping.pattern, spec);
  if (capture === null) return [];
  const resolved = new Set();
  for (const targetPattern of mapping.targets) {
    const target = targetPattern.includes('*') ? targetPattern.replaceAll('*', capture) : targetPattern;
    const base = normalize(path.posix.join(mapping.base_url, target));
    for (const candidate of moduleCandidates(base)) {
      if (fileSet.has(candidate)) resolved.add(candidate);
    }
  }
  return [...resolved];
}

export function augmentTsAliasGraph(root, files, fileSet, nodes, edges) {
  const mappings = loadMappings(root, files);
  if (!mappings.length) return;
  for (const rel of files) {
    if (!JS_TS_EXTENSIONS.has(path.posix.extname(rel).toLowerCase())) continue;
    const text = readSmallText(root, rel);
    if (!text) continue;
    const sourceId = fileNodeId(rel);
    for (const spec of importSpecs(text)) {
      if (spec.startsWith('.')) continue;
      const matching = mappings.filter((mapping) => (!mapping.config_dir || rel === mapping.config_dir || rel.startsWith(`${mapping.config_dir}/`)) && aliasCapture(mapping.pattern, spec) !== null);
      if (!matching.length) continue;
      const targets = new Set(matching.flatMap((mapping) => aliasTargets(mapping, spec, fileSet)));
      if (targets.size === 1) {
        edges.push({
          source: sourceId,
          target: fileNodeId([...targets][0]),
          relation: nodes.get(sourceId)?.domain === 'test' ? 'TESTS' : 'DEPENDS_ON',
          provenance: 'deterministic',
          authority: 'tsconfig-path-alias',
          source_ref: matching.map((mapping) => mapping.source_ref).sort().join(','),
          extractor: 'ts-path-alias-extractor',
          confidence: 1,
        });
      } else if (targets.size > 1) {
        const current = nodes.get(sourceId);
        if (!current) continue;
        nodes.set(sourceId, {
          ...current,
          metadata: {
            ...(current.metadata || {}),
            ambiguous_imports: [
              ...(current.metadata?.ambiguous_imports || []),
              {
                specifier: spec,
                candidates: [...targets].sort(),
                source_refs: [...new Set(matching.map((mapping) => mapping.source_ref))].sort(),
              },
            ],
          },
        });
      }
    }
  }
}
