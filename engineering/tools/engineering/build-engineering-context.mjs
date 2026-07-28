#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, '../..');

function hashBuffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashFile(filePath) {
  return hashBuffer(fs.readFileSync(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalise(value) {
  return value.replace(/\\/g, '/');
}

function globToRegExp(glob) {
  let output = '^';
  let index = 0;
  while (index < glob.length) {
    const character = glob[index];
    if (character === '*') {
      if (glob[index + 1] === '*') {
        if (glob[index + 2] === '/') {
          output += '(?:.*/)?';
          index += 3;
        } else {
          output += '.*';
          index += 2;
        }
      } else {
        output += '[^/]*';
        index += 1;
      }
      continue;
    }
    output += '\\^$+.|()[]{}'.includes(character) ? '\\' + character : character;
    index += 1;
  }
  return new RegExp(output + '$');
}

function walk(directory) {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else result.push(full);
  }
  return result;
}

function filesForPatterns(root, patterns) {
  const all = walk(root).filter((filePath) => !filePath.includes(path.sep + '.git' + path.sep));
  const records = [];
  for (const pattern of patterns) {
    const matcher = globToRegExp(pattern);
    const matched = all.filter((filePath) =>
      matcher.test(normalise(path.relative(root, filePath))),
    );
    if (!matched.length) throw new Error('Context source pattern matched no files: ' + pattern);
    for (const filePath of matched) records.push(filePath);
  }
  return [...new Set(records)].sort();
}

function hashRecords(root, files, scope) {
  return files.map((filePath) => ({
    scope,
    path: normalise(path.relative(root, filePath)),
    sha256: hashFile(filePath),
  }));
}

function digestRecords(records) {
  return hashBuffer(
    records.map((record) => record.scope + '\0' + record.path + '\0' + record.sha256).join('\n'),
  );
}

function parseArguments(argv) {
  const options = { root: defaultRoot, verify: false };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--root') {
      options.root = argv[index + 1];
      index += 1;
    } else if (option === '--repo-root') {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else if (option === '--output') {
      options.output = argv[index + 1];
      index += 1;
    } else if (option === '--verify') {
      options.verify = true;
    } else if (option === '--help') {
      options.help = true;
    } else {
      throw new Error('Unknown argument: ' + option);
    }
  }
  return options;
}

export function createEngineeringContext({ root = defaultRoot, repoRoot = null }) {
  const packageRoot = path.resolve(root);
  const registry = readJson(path.join(packageRoot, 'ops/context-source-registry.v5.json'));
  const packageFiles = filesForPatterns(
    packageRoot,
    registry.packageSources || registry.sources || [],
  );
  const packageRecords = hashRecords(packageRoot, packageFiles, 'package');
  let repositoryRecords = [];
  if (repoRoot) {
    const resolvedRepo = path.resolve(repoRoot);
    const repoFiles = filesForPatterns(resolvedRepo, registry.repositorySources || []);
    repositoryRecords = hashRecords(resolvedRepo, repoFiles, 'repository');
  }
  const records = [...packageRecords, ...repositoryRecords].sort((left, right) =>
    (left.scope + '/' + left.path).localeCompare(right.scope + '/' + right.path),
  );
  return {
    schema_version: 1,
    system: 'ARQ Engineering OS',
    version: '5.0.0',
    hash_algorithm: registry.hashAlgorithm,
    repository_bound: Boolean(repoRoot),
    source_hash: digestRecords(records),
    source_records: records,
  };
}

export function verifyEngineeringContext({ root = defaultRoot, repoRoot = null }) {
  const packageRoot = path.resolve(root);
  const registry = readJson(path.join(packageRoot, 'ops/context-source-registry.v5.json'));
  const outputPath = path.join(packageRoot, registry.generatedContext);
  if (!fs.existsSync(outputPath))
    return { ok: false, reason: 'Generated engineering context is missing.', outputPath };
  const committed = readJson(outputPath);
  const expected = createEngineeringContext({ root: packageRoot, repoRoot });
  if (!repoRoot && committed.repository_bound) {
    const packageRecords = committed.source_records.filter((record) => record.scope === 'package');
    const expectedPackage = expected.source_records.filter((record) => record.scope === 'package');
    const same = JSON.stringify(packageRecords) === JSON.stringify(expectedPackage);
    return {
      ok: same,
      reason: same ? null : 'Package context sources are stale.',
      scope: 'package-only',
      outputPath,
    };
  }
  const same = JSON.stringify(committed) === JSON.stringify(expected);
  return {
    ok: same,
    reason: same ? null : 'Generated engineering context is stale.',
    scope: repoRoot ? 'package-and-repository' : 'package-only',
    outputPath,
  };
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      'Usage: node build-engineering-context.mjs [--root PACKAGE_ROOT] [--repo-root ARQ_REPOSITORY] [--output PATH] [--verify]\n',
    );
    return;
  }
  const root = path.resolve(options.root);
  if (options.verify) {
    const result = verifyEngineeringContext({ root, repoRoot: options.repoRoot });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (!result.ok) process.exitCode = 1;
    return;
  }
  const registry = readJson(path.join(root, 'ops/context-source-registry.v5.json'));
  const outputPath = path.resolve(options.output || path.join(root, registry.generatedContext));
  const context = createEngineeringContext({ root, repoRoot: options.repoRoot });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(context, null, 2) + '\n');
  process.stdout.write('Wrote source-hashed engineering context: ' + outputPath + '\n');
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) runCli();
