#!/usr/bin/env node

import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = path.resolve(scriptDirectory, '../..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function git(repoRoot, args) {
  const result = childProcess.spawnSync('git', ['-C', repoRoot, ...args], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

function parseArguments(argv) {
  const options = { packageRoot: defaultPackageRoot, strict: false };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--repo-root') {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else if (option === '--package-root') {
      options.packageRoot = argv[index + 1];
      index += 1;
    } else if (option === '--strict') {
      options.strict = true;
    } else if (option === '--output') {
      options.output = argv[index + 1];
      index += 1;
    } else if (option === '--help') {
      options.help = true;
    } else {
      throw new Error('Unknown argument: ' + option);
    }
  }
  return options;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function collectDeclaredPaths(packageRoot) {
  const files = ['ops/active-surface-register.v5.json', 'ops/critical-contracts.v5.json'];
  const result = [];
  for (const relative of files) {
    const value = readJson(path.join(packageRoot, relative));
    const entries = value.surfaces || value.contracts || [];
    for (const entry of entries) {
      for (const sourcePath of entry.sourcePaths || [])
        result.push({ record: entry.id, sourcePath });
    }
  }
  const conflicts = readJson(path.join(packageRoot, 'ops/conflict-registry.v5.json'));
  for (const conflict of conflicts.conflicts || []) {
    for (const source of conflict.sources || []) {
      if (source.path) result.push({ record: 'conflict:' + conflict.id, sourcePath: source.path });
    }
  }
  return result;
}

function checkEvidenceScripts(repoPackage, catalog, warnings) {
  const scripts = repoPackage.scripts || {};
  for (const evidence of catalog.evidence || []) {
    if (evidence.state !== 'available' || !evidence.packageScript) continue;
    if (!Object.hasOwn(scripts, evidence.packageScript)) {
      warnings.push(
        'Evidence ' + evidence.id + ' expects missing package script: ' + evidence.packageScript,
      );
    }
  }
}

function reportWorkflowGaps(repoRoot, baseline, warnings) {
  const ciPath = path.join(repoRoot, '.github/workflows/ci.yml');
  const pagesPath = path.join(repoRoot, '.github/workflows/deploy-pages.yml');
  const ownersPath = path.join(repoRoot, '.github/CODEOWNERS');
  const ci = fs.existsSync(ciPath) ? fs.readFileSync(ciPath, 'utf8') : '';
  const pages = fs.existsSync(pagesPath) ? fs.readFileSync(pagesPath, 'utf8') : '';
  const owners = fs.existsSync(ownersPath) ? fs.readFileSync(ownersPath, 'utf8') : '';
  const branch = baseline.repository.defaultBranch;
  if (!ci.includes(branch))
    warnings.push(
      'CI workflow does not name the audited default branch ' +
        branch +
        '. Review push trigger and required-check coverage.',
    );
  if (!ci.includes('merge_group'))
    warnings.push(
      'CI workflow does not include merge_group coverage. Add it before enabling merge queue protections.',
    );
  if (owners.includes('@REPLACE'))
    warnings.push(
      'CODEOWNERS contains @REPLACE placeholders. Code-owner enforcement is not ready.',
    );
  if (!pages.includes('arq:language:site:build:verify'))
    warnings.push(
      'Pages workflow does not yet run rendered public-site proof from Language System 4.1.',
    );
  if (!pages.includes('arq:language:site:live:verify'))
    warnings.push(
      'Pages workflow does not yet run post-deploy public-site proof from Language System 4.1.',
    );
}

export function verifyRepoBindings({ repoRoot, packageRoot = defaultPackageRoot }) {
  const root = path.resolve(repoRoot);
  const packageDirectory = path.resolve(packageRoot);
  const errors = [];
  const warnings = [];
  if (!fs.existsSync(path.join(root, 'package.json')))
    errors.push('Repository root does not contain package.json: ' + root);
  if (!fs.existsSync(path.join(root, '.git')))
    warnings.push(
      'Repository root is not a normal Git checkout. Commit and branch comparisons are unavailable.',
    );
  if (errors.length)
    return { status: 'blocked', errors, warnings, repoRoot: root, packageRoot: packageDirectory };

  const baseline = readJson(path.join(packageDirectory, 'ops/repo-baseline.v5.json'));
  const catalog = readJson(path.join(packageDirectory, 'ops/evidence-catalog.v5.json'));
  const repoPackage = readJson(path.join(root, 'package.json'));
  const actualCommit = git(root, ['rev-parse', 'HEAD']);
  const remoteHead = git(root, ['symbolic-ref', 'refs/remotes/origin/HEAD']);
  const actualDefaultBranch = remoteHead
    ? remoteHead.replace(/^refs\/remotes\/origin\//, '')
    : null;

  for (const { record, sourcePath } of collectDeclaredPaths(packageDirectory)) {
    if (!fs.existsSync(path.join(root, sourcePath)))
      errors.push('Missing bound source path for ' + record + ': ' + sourcePath);
  }
  if (!String(repoPackage.engines?.node || '').includes('20'))
    warnings.push('package.json engines.node does not visibly declare Node 20 compatibility.');
  if (repoPackage.packageManager !== baseline.runtime.packageManager)
    warnings.push(
      'Package manager differs from audit baseline: expected ' +
        baseline.runtime.packageManager +
        ', found ' +
        (repoPackage.packageManager || 'none') +
        '.',
    );
  if (actualCommit && actualCommit !== baseline.repository.commit)
    warnings.push(
      'Repository HEAD differs from audited baseline. Refresh the audit baseline and generated context through review before treating this package as current.',
    );
  if (actualDefaultBranch && actualDefaultBranch !== baseline.repository.defaultBranch)
    warnings.push(
      'Remote default branch differs from audited baseline: ' + actualDefaultBranch + '.',
    );
  checkEvidenceScripts(repoPackage, catalog, warnings);
  reportWorkflowGaps(root, baseline, warnings);

  const status = errors.length ? 'blocked' : warnings.length ? 'needs-owner-action' : 'ready';
  return {
    schema_version: 1,
    status,
    repository: {
      root,
      commit: actualCommit,
      remoteDefaultBranch: actualDefaultBranch,
      auditedCommit: baseline.repository.commit,
      auditedDefaultBranch: baseline.repository.defaultBranch,
    },
    errors,
    warnings,
    checkedPaths: collectDeclaredPaths(packageDirectory).length,
  };
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      'Usage: node verify-repo-bindings.mjs --repo-root PATH [--package-root PACKAGE_ROOT] [--strict] [--output report.json]\n',
    );
    return;
  }
  if (!options.repoRoot) throw new Error('--repo-root is required.');
  const result = verifyRepoBindings({
    repoRoot: options.repoRoot,
    packageRoot: options.packageRoot,
  });
  if (options.output) writeJson(options.output, result);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.errors.length || (options.strict && result.warnings.length)) process.exitCode = 1;
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) runCli();
