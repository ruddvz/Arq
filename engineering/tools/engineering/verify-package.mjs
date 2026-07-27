#!/usr/bin/env node

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, '../..');
const requiredFiles = [
  'README.md',
  '00_START_HERE.md',
  '00_RELEASE_NOTES_5.0.md',
  '00-audit/ENGINEERING_OS_4.0_CRITIQUE.md',
  '00-audit/ARQ_REPOSITORY_AND_SITE_AUDIT_2026-07-27.md',
  '00-audit/CURRENT_TRUTH_CONFLICTS.md',
  '30_ZEUS_AND_ENGINEERING_AUTHORITY.md',
  '31_PUBLIC_SITE_AND_LANGUAGE_INTERLOCK.md',
  '32_PROOF_GAPS_AND_CLOSURE_PLAN.md',
  '33_IMPLEMENTATION_HANDOFF.md',
  '34_LIMITS_AND_OWNER_DECISIONS.md',
  'ops/change-map.v5.json',
  'ops/evidence-catalog.v5.json',
  'ops/critical-contracts.v5.json',
  'ops/conflict-registry.v5.json',
  'ops/generated/engineering-context-v5.json',
  'tools/engineering/classify-change.mjs',
  'tools/engineering/verify-evidence.mjs',
  'tools/engineering/verify-policy.mjs',
  'tools/engineering/verify-repo-bindings.mjs',
  'tools/engineering/build-engineering-context.mjs',
  'tools/engineering/verify-engineering-context.mjs',
  'tools/engineering/run-selected-evidence.mjs',
  'tools/engineering/verify-workflow-templates.mjs',
  'tools/engineering/verify-template-data.mjs',
  'tools/engineering/run-fixtures.mjs',
  'tools/engineering/build-manifest.mjs',
  'templates/.github/workflows/engineering-gate.v5.reference.yml',
  'templates/.github/workflows/deploy-pages.v5.fragment.yml',
  'MANIFEST.json',
  'SHA256SUMS.md',
];

function parseArguments(argv) {
  const options = { root: defaultRoot };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--root') {
      options.root = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--help') {
      options.help = true;
    } else {
      throw new Error('Unknown argument: ' + argv[index]);
    }
  }
  return options;
}

function walk(directory) {
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walk(fullPath));
    else results.push(fullPath);
  }
  return results;
}

function runNode(root, script, args = []) {
  const result = childProcess.spawnSync(
    process.execPath,
    [path.join(root, 'tools/engineering', script), ...args],
    { cwd: root, encoding: 'utf8' },
  );
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  return result.status === 0;
}

export function verifyPackage(root) {
  const packageRoot = path.resolve(root);
  const errors = [];
  for (const relativePath of requiredFiles) {
    if (!fs.existsSync(path.join(packageRoot, relativePath)))
      errors.push('Missing required file: ' + relativePath);
  }
  for (const filePath of walk(packageRoot)) {
    const relativePath = path.relative(packageRoot, filePath).replace(/\\/g, '/');
    const extension = path.extname(filePath).toLowerCase();
    const content = fs.readFileSync(filePath, 'utf8');
    if (['.json'].includes(extension)) {
      try {
        JSON.parse(content);
      } catch (error) {
        errors.push('Invalid JSON ' + relativePath + ': ' + error.message);
      }
    }
    if (
      ['.md', '.json', '.mjs', '.yml', '.yaml'].includes(extension) &&
      content.includes(String.fromCharCode(0x2014))
    ) {
      errors.push('Em dash found in authored package file: ' + relativePath);
    }
  }
  if (!runNode(packageRoot, 'verify-policy.mjs', ['--root', packageRoot]))
    errors.push('Policy validation failed.');
  if (!runNode(packageRoot, 'verify-engineering-context.mjs', ['--root', packageRoot]))
    errors.push('Generated engineering context validation failed.');
  if (!runNode(packageRoot, 'run-fixtures.mjs')) errors.push('Fixture validation failed.');
  if (!runNode(packageRoot, 'verify-workflow-templates.mjs'))
    errors.push('Workflow template validation failed.');
  if (!runNode(packageRoot, 'verify-template-data.mjs'))
    errors.push('Template data validation failed.');
  if (!runNode(packageRoot, 'build-manifest.mjs', ['--root', packageRoot, '--verify']))
    errors.push('Manifest validation failed.');
  return { ok: errors.length === 0, errors };
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write('Usage: node verify-package.mjs [--root PACKAGE_ROOT]\n');
    return;
  }
  const result = verifyPackage(options.root);
  if (result.ok) process.stdout.write('ARQ Engineering OS 5.0 package validation passed.\n');
  else {
    for (const error of result.errors) process.stderr.write('PACKAGE ERROR: ' + error + '\n');
    process.exitCode = 1;
  }
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) runCli();
