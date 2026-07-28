#!/usr/bin/env node
/**
 * Generate a deterministic, source-hashed language context from a live Arq checkout.
 * This script never promotes a claim. It exposes drift and structured source data.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const repoRoot = resolve(value('--repo-root', process.cwd()));
const languageRoot = resolve(value('--language-root', join(repoRoot, 'docs/product/voice')));
const output = resolve(value('--output', join(languageRoot, 'generated-repo-context.json')));
const sha = (input) => createHash('sha256').update(input).digest('hex');
const bytes = (input) => Buffer.byteLength(input);
function locateLanguage(rel) {
  const candidates = [
    join(languageRoot, rel),
    join(languageRoot, rel.replace(/^02-canonical\//, '')),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Missing language artifact ${rel}`);
  return found;
}
function filesRecursive(path) {
  const out = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const full = join(path, entry.name);
    if (entry.isDirectory()) out.push(...filesRecursive(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}
function recordSource(source) {
  if (isAbsolute(source.path) || source.path.includes('..'))
    throw new Error(`Unsafe source path ${source.path}`);
  const absolute = join(repoRoot, source.path);
  if (!existsSync(absolute)) return { missing: true, id: source.id, path: source.path };
  const info = statSync(absolute);
  if (source.kind === 'file') {
    if (!info.isFile()) throw new Error(`${source.id} is not a file: ${source.path}`);
    const text = readFileSync(absolute, 'utf8');
    return {
      id: source.id,
      kind: 'file',
      path: source.path,
      sha256: sha(text),
      bytes: bytes(text),
    };
  }
  if (!info.isDirectory()) throw new Error(`${source.id} is not a directory: ${source.path}`);
  const files = filesRecursive(absolute).map((file) => {
    const text = readFileSync(file, 'utf8');
    return {
      rel: relative(repoRoot, file).replace(/\\/g, '/'),
      sha256: sha(text),
      bytes: bytes(text),
    };
  });
  if (!files.length && source.required) return { missing: true, id: source.id, path: source.path };
  return {
    id: source.id,
    kind: 'directory',
    path: source.path,
    sha256: sha(files.map((file) => `${file.rel}:${file.sha256}:${file.bytes}`).join('\n')),
    files,
  };
}
function readRepo(rel) {
  return readFileSync(join(repoRoot, rel), 'utf8');
}
function readJson(rel) {
  return JSON.parse(readRepo(rel));
}
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const split = (line) => {
    const cells = [];
    let value = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') {
          value += '"';
          i += 1;
        } else quoted = !quoted;
      } else if (char === ',' && !quoted) {
        cells.push(value);
        value = '';
      } else value += char;
    }
    cells.push(value);
    return cells;
  };
  const headers = split(lines[0]);
  return lines
    .slice(1)
    .map((line) =>
      Object.fromEntries(headers.map((header, index) => [header, split(line)[index] ?? ''])),
    );
}
function parseUnion(text, declaration, discriminator) {
  const match = text.match(declaration);
  return match ? [...match[1].matchAll(discriminator)].map((x) => x[1]) : [];
}
function parseFileFlow(text) {
  return parseUnion(
    text,
    /export type FileFlowState\s*=([\s\S]*?);\s*\n\s*export type FileFlowEvent/,
    /kind:\s*'([^']+)'/g,
  );
}
function parseSafeMode(text) {
  return parseUnion(text, /export type ArqfsSafeModePlanKind\s*=([\s\S]*?);/, /'([^']+)'/g);
}
function parseJournalUi(text) {
  const match = text.match(/useState<\s*([\s\S]*?)>\s*\(\s*'no-project'\s*\)/);
  return match ? [...match[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
}

const contextContractPath = locateLanguage('02-canonical/context-contract.json');
const contractText = readFileSync(contextContractPath, 'utf8');
const contract = JSON.parse(contractText);
const records = {};
const missing = [];
for (const source of contract.sourceSets ?? []) {
  const record = recordSource(source);
  if (record.missing) {
    if (source.required) missing.push(source.path);
    continue;
  }
  records[source.id] = record;
}
if (missing.length) {
  console.error(`FAIL missing required language-context source(s): ${missing.join(', ')}`);
  process.exit(1);
}
const sourceSetDigest = sha(
  Object.entries(records)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, record]) => `${id}:${record.sha256}`)
    .join('\n'),
);
const registryRoot = 'packages/workspace/src/registry';
const context = {
  schemaVersion: 4,
  contractVersion: '4.1.0',
  sourceContractDigest: sha(contractText),
  sourceSetDigest,
  sourceContextGeneratedBy: 'refresh-repo-context.mjs@4.1',
  sources: records,
  registries: {
    tools: readJson(`${registryRoot}/workspace-tool-registry.json`),
    tabs: readJson(`${registryRoot}/workspace-tab-registry.json`),
    panels: readJson(`${registryRoot}/workspace-panel-registry.json`),
    states: readJson(`${registryRoot}/workspace-state-machines.json`),
    capabilities: readJson(`${registryRoot}/workspace-capability-gates.json`),
    workspaceSurfaces: readJson(`${registryRoot}/workspace-surface-registry.json`),
  },
  routes: parseCsv(readRepo('docs/pages/ROUTE-MAP.csv')),
  permissions: parseCsv(readRepo('security/RBAC-MATRIX.csv')),
  telemetry: parseCsv(readRepo('analytics/EVENT-DICTIONARY.csv')),
  externalStates: {
    'arqfs-safe-mode': parseSafeMode(readRepo('packages/arqfs/src/arqfs-safe-mode.ts')),
    'file-flow': parseFileFlow(readRepo('apps/web/src/file-handling/file-state-machine.ts')),
    'web-plan-journal-status': parseJournalUi(readRepo('apps/web/src/App.tsx')),
  },
  textSources: {
    readme: readRepo('README.md'),
    status: readRepo('STATUS.md'),
    releaseScope: readRepo('docs/product/RELEASE-SCOPE.md'),
    productCopyPrinciples: readRepo('docs/product/PRODUCT-COPY-PRINCIPLES.md'),
    aiGuardrails: readRepo('docs/ai/AI-GUARDRAILS.md'),
    formatMatrix: readRepo('docs/interoperability/FORMAT-SUPPORT-MATRIX.md'),
    security: readRepo('SECURITY.md'),
    launchClaims: readRepo('business/LAUNCH-CLAIMS-CHECKLIST.md'),
  },
};
/*
 * Refresh log. Every substantive refresh (a digest change) appends an entry
 * naming the source sets that moved, so the record of what changed and when is
 * written by the same step that updates the context. verify-arq-language-context
 * requires the latest entry to match the committed context, which makes an
 * unlogged update fail CI. The log itself is not a hashed source set, so
 * writing it cannot invalidate the context it describes.
 */
const logPath = join(languageRoot, 'context/REFRESH-LOG.json');
let previous = null;
if (existsSync(output)) {
  try {
    previous = JSON.parse(readFileSync(output, 'utf8'));
  } catch {
    previous = null;
  }
}
let refreshLog = { schemaVersion: 1, entries: [] };
if (existsSync(logPath)) {
  try {
    const parsed = JSON.parse(readFileSync(logPath, 'utf8'));
    if (Array.isArray(parsed?.entries)) refreshLog = parsed;
  } catch {
    /* an unreadable log is rebuilt from this refresh */
  }
}
if (refreshLog.entries[0]?.sourceSetDigest !== sourceSetDigest) {
  const previousSources = previous?.sources ?? {};
  const changedSourceSets = [...new Set([...Object.keys(previousSources), ...Object.keys(records)])]
    .filter((id) => previousSources[id]?.sha256 !== records[id]?.sha256)
    .sort();
  refreshLog.entries.unshift({
    generatedAt: new Date().toISOString(),
    sourceSetDigest,
    previousSourceSetDigest: previous?.sourceSetDigest ?? null,
    changedSourceSets,
  });
  writeFileSync(logPath, `${JSON.stringify(refreshLog, null, 2)}\n`);
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(context, null, 2)}\n`);
console.log(
  `Wrote ${output} from ${Object.keys(records).length} source sets (${sourceSetDigest.slice(0, 12)}).`,
);
