#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, '../..');
const excluded = new Set(['MANIFEST.json', 'SHA256SUMS.md']);

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function walk(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function relative(root, filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function payloadFiles(root) {
  return walk(root)
    .filter((filePath) => !excluded.has(relative(root, filePath)))
    .sort((left, right) => relative(root, left).localeCompare(relative(root, right)));
}

function recordFiles(root, files) {
  return files.map((filePath) => ({
    path: relative(root, filePath),
    bytes: fs.statSync(filePath).size,
    sha256: sha256(filePath),
  }));
}

function parseArguments(argv) {
  const options = { root: defaultRoot, verify: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root') {
      options.root = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--verify') {
      options.verify = true;
    } else if (argv[index] === '--help') {
      options.help = true;
    } else {
      throw new Error('Unknown argument: ' + argv[index]);
    }
  }
  return options;
}

export function buildManifest(root) {
  const packageRoot = path.resolve(root);
  const before = payloadFiles(packageRoot);
  const packageManifest = [
    '# Package Manifest',
    '',
    'Package: ARQ Engineering OS 5.0',
    '',
    'Payload files: ' + before.length,
    '',
    'Integrity is verified by `node tools/engineering/build-manifest.mjs --verify`.',
    'The generated `MANIFEST.json` records payload hashes. `SHA256SUMS.md` covers the manifest and every payload file.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(packageRoot, 'PACKAGE_MANIFEST.md'), packageManifest);
  const records = recordFiles(packageRoot, payloadFiles(packageRoot));
  const manifest = {
    schema_version: 1,
    package: 'ARQ Engineering OS',
    version: '5.0.0',
    hash_algorithm: 'sha256',
    files: records,
  };
  fs.writeFileSync(
    path.join(packageRoot, 'MANIFEST.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  const shaRecords = recordFiles(
    packageRoot,
    walk(packageRoot)
      .filter((filePath) => relative(packageRoot, filePath) !== 'SHA256SUMS.md')
      .sort((left, right) =>
        relative(packageRoot, left).localeCompare(relative(packageRoot, right)),
      ),
  );
  fs.writeFileSync(
    path.join(packageRoot, 'SHA256SUMS.md'),
    shaRecords.map((record) => record.sha256 + '  ' + record.path).join('\n') + '\n',
  );
  return { manifestFiles: records.length, shaFiles: shaRecords.length };
}

export function verifyManifest(root) {
  const packageRoot = path.resolve(root);
  const errors = [];
  const manifestPath = path.join(packageRoot, 'MANIFEST.json');
  const sumsPath = path.join(packageRoot, 'SHA256SUMS.md');
  if (!fs.existsSync(manifestPath)) errors.push('MANIFEST.json is missing.');
  if (!fs.existsSync(sumsPath)) errors.push('SHA256SUMS.md is missing.');
  if (errors.length) return { ok: false, errors };
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    return { ok: false, errors: ['MANIFEST.json is invalid: ' + error.message] };
  }
  const actualPayload = recordFiles(packageRoot, payloadFiles(packageRoot));
  const expectedPayload = manifest.files || [];
  if (JSON.stringify(actualPayload) !== JSON.stringify(expectedPayload))
    errors.push('MANIFEST.json does not match the current payload files and hashes.');
  const expectedSums = new Map();
  for (const line of fs.readFileSync(sumsPath, 'utf8').trim().split(/\r?\n/).filter(Boolean)) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    if (!match) {
      errors.push('Malformed SHA256SUMS line: ' + line);
      continue;
    }
    if (expectedSums.has(match[2])) errors.push('Duplicate SHA256SUMS path: ' + match[2]);
    expectedSums.set(match[2], match[1]);
  }
  const actualSumFiles = walk(packageRoot)
    .filter((filePath) => relative(packageRoot, filePath) !== 'SHA256SUMS.md')
    .sort((left, right) => relative(packageRoot, left).localeCompare(relative(packageRoot, right)));
  if (expectedSums.size !== actualSumFiles.length)
    errors.push('SHA256SUMS file count does not match the current package files.');
  for (const filePath of actualSumFiles) {
    const key = relative(packageRoot, filePath);
    if (!expectedSums.has(key)) errors.push('SHA256SUMS is missing ' + key);
    else if (expectedSums.get(key) !== sha256(filePath))
      errors.push('SHA256SUMS hash mismatch for ' + key);
  }
  return {
    ok: errors.length === 0,
    errors,
    payloadFiles: actualPayload.length,
    sumFiles: actualSumFiles.length,
  };
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write('Usage: node build-manifest.mjs [--root PACKAGE_ROOT] [--verify]\n');
    return;
  }
  const result = options.verify ? verifyManifest(options.root) : buildManifest(options.root);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (options.verify && !result.ok) process.exitCode = 1;
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) runCli();
