#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const repoRoot = resolve(value('--repo-root', process.cwd()));
const languageRoot = resolve(value('--language-root', join(repoRoot, 'docs/product/voice')));
const contextPath = resolve(value('--context', join(languageRoot, 'generated-repo-context.json')));
const sha = (input) => createHash('sha256').update(input).digest('hex');
function locateLanguage(rel) {
  const candidates = [
    join(languageRoot, rel),
    join(languageRoot, rel.replace(/^02-canonical\//, '')),
    join(PACKAGE_ROOT, rel),
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
function expectedRecord(source) {
  if (isAbsolute(source.path) || source.path.includes('..'))
    throw new Error(`Unsafe source path ${source.path}`);
  const path = join(repoRoot, source.path);
  if (!existsSync(path)) return null;
  const info = statSync(path);
  if (source.kind === 'file') {
    if (!info.isFile()) return null;
    const text = readFileSync(path, 'utf8');
    return {
      id: source.id,
      kind: 'file',
      path: source.path,
      sha256: sha(text),
      bytes: Buffer.byteLength(text),
    };
  }
  if (!info.isDirectory()) return null;
  const files = filesRecursive(path).map((file) => {
    const text = readFileSync(file, 'utf8');
    return {
      rel: relative(repoRoot, file).replace(/\\/g, '/'),
      sha256: sha(text),
      bytes: Buffer.byteLength(text),
    };
  });
  return {
    id: source.id,
    kind: 'directory',
    path: source.path,
    sha256: sha(files.map((file) => `${file.rel}:${file.sha256}:${file.bytes}`).join('\n')),
    files,
  };
}
if (!existsSync(contextPath)) {
  console.error(`FAIL generated context missing: ${contextPath}`);
  process.exit(1);
}
const context = JSON.parse(readFileSync(contextPath, 'utf8'));
const contractPath = locateLanguage('02-canonical/context-contract.json');
const contractText = readFileSync(contractPath, 'utf8');
const contract = JSON.parse(contractText);
let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};
if (context.schemaVersion !== 4)
  fail(`generated context schema ${context.schemaVersion ?? '(missing)'} is not 4`);
if (context.contractVersion !== '4.1.0') fail('generated context contract version is not 4.1.0');
if (context.sourceContractDigest !== sha(contractText))
  fail('generated context was built from a different context contract');
if ('repoRootHint' in context || JSON.stringify(context).includes(repoRoot))
  fail('generated context must not persist an absolute repository path');
const actualRecords = {};
for (const source of contract.sourceSets ?? []) {
  const expected = expectedRecord(source);
  const recorded = context.sources?.[source.id];
  if (source.required && !expected) {
    fail(`required source missing: ${source.path}`);
    continue;
  }
  if (!expected) continue;
  if (!recorded) {
    fail(`generated context misses source ${source.id}`);
    continue;
  }
  if (JSON.stringify(recorded) !== JSON.stringify(expected))
    fail(`stale generated context source ${source.path}`);
  actualRecords[source.id] = expected;
}
for (const id of Object.keys(context.sources ?? {}))
  if (!(id in actualRecords)) fail(`generated context has uncontracted source ${id}`);
const digest = sha(
  Object.entries(actualRecords)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, record]) => `${id}:${record.sha256}`)
    .join('\n'),
);
if (context.sourceSetDigest !== digest) fail('generated context source-set digest mismatch');
/*
 * The refresh log written by refresh-arq-language-context must record the
 * digest the committed context carries. This fails a context that was updated
 * without its change being logged, so the record of which source sets moved
 * stays complete.
 */
const refreshLogPath = join(languageRoot, 'context/REFRESH-LOG.json');
if (!existsSync(refreshLogPath)) {
  fail('context refresh log missing: run arq:language:refresh');
} else {
  let refreshLog = null;
  try {
    refreshLog = JSON.parse(readFileSync(refreshLogPath, 'utf8'));
  } catch {
    refreshLog = null;
  }
  const latest = refreshLog?.entries?.[0];
  if (!latest?.sourceSetDigest) fail('context refresh log has no entries');
  else if (latest.sourceSetDigest !== context.sourceSetDigest)
    fail('context change is not logged: run arq:language:refresh');
  else if (!Array.isArray(latest.changedSourceSets))
    fail('latest refresh log entry does not record changed source sets');
}
if (failures) {
  console.error(
    `\n${failures} repo-context freshness failure(s). Run arq:language:refresh after fixing canonical sources.`,
  );
  process.exit(1);
}
console.log(`PASS generated repo context is fresh (${digest.slice(0, 12)}).`);
