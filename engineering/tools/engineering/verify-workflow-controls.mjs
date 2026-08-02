#!/usr/bin/env node

/**
 * Verifies that this repository's LIVE workflows still carry the Engineering OS
 * 5.0 controls their reference templates specify.
 *
 * Replaces verify-workflow-templates.mjs, which read
 * `engineering/templates/.github/workflows/*.yml` and threw ENOENT on every
 * invocation, because those two files are the only entries in
 * installation-map.v5.json's `workflowReferences` rather than its `copy` list -
 * they are references to adapt, not files to install, and they were correctly
 * never copied in. Nothing ran the script (its only caller, verify-package.mjs,
 * validates a distribution archive and is itself unrunnable here), so a control
 * that could not pass also never failed anybody.
 *
 * Checking the template was the wrong target regardless. A template proves
 * nothing about what gates merges; `.github/workflows/engineering-gate.yml`
 * does, and its own header documents deliberate differences from the reference.
 * So the pairs come from the installation map's `from` -> `to` mapping and the
 * assertions run against `to`: the live file, the one that decides.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = path.resolve(scriptDirectory, '../..');

/**
 * Keyed by the reference template each live workflow was adapted from, so the
 * installation map stays the only place that says which file is which.
 */
const CONTROLS = Object.freeze({
  'templates/.github/workflows/engineering-gate.v5.reference.yml': [
    ['pull_request trigger', /^\s+pull_request:\s*$/m],
    ['merge_group trigger', /^\s+merge_group:\s*$/m],
    ['least-privilege contents permission', /^\s+contents:\s+read\s*$/m],
    ['base-to-head diff', /git diff --name-only "\$base_sha" "\$head_sha"/],
    ['policy verification', /verify-policy\.mjs --root engineering/],
    [
      'context verification before evidence',
      /verify-engineering-context\.mjs --root engineering --repo-root \./,
    ],
    ['selected evidence runner', /run-selected-evidence\.mjs/],
    ['protected L4 Environment', /name:\s+arq-critical-change/],
    ['final evidence evaluation', /verify-evidence\.mjs/],
    ['always-running final gate', /engineering-gate:\n\s+if:\s+always\(\)/],
  ],
  'templates/.github/workflows/deploy-pages.v5.fragment.yml': [
    ['source and route verification', /pnpm arq:language:verify/],
    ['rendered artifact proof', /pnpm arq:language:site:build:verify/],
    ['commit-bound proof', /--commit "\$\{\{ github\.sha \}\}"/],
    ['live deployed verification', /pnpm arq:language:site:live:verify/],
    ['deployment output binding', /needs\.deploy\.outputs\.page_url/],
  ],
});

// Split so the scanner cannot match its own source.
const FORBIDDEN_PLACEHOLDERS = ['REPLACE_' + 'AFTER_AUDIT', 'TODO_' + 'OWNER', 'TBD_' + 'OWNER'];

function parseArguments(argv) {
  const options = { packageRoot: defaultPackageRoot, repoRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--package-root') {
      options.packageRoot = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--repo-root') {
      options.repoRoot = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--help') {
      options.help = true;
    } else {
      throw new Error('Unknown argument: ' + argv[index]);
    }
  }
  return options;
}

export function verifyWorkflowControls({ packageRoot, repoRoot }) {
  const errors = [];
  const checked = [];
  const mapPath = path.join(packageRoot, 'ops/installation-map.v5.json');
  if (!fs.existsSync(mapPath)) {
    return { errors: ['Missing installation map: ' + mapPath], checked };
  }
  const references = JSON.parse(fs.readFileSync(mapPath, 'utf8')).workflowReferences;
  if (!Array.isArray(references) || references.length === 0) {
    return { errors: ['Installation map declares no workflowReferences to verify.'], checked };
  }

  for (const reference of references) {
    const controls = CONTROLS[reference?.from];
    // An unmapped reference is a failure, not a skip: adding a workflow
    // reference without controls would otherwise silently widen what ships
    // ungoverned, which is the same shape of hole this script exists to close.
    if (controls === undefined) {
      errors.push('No controls defined for workflow reference ' + reference?.from);
      continue;
    }
    const livePath = path.resolve(repoRoot, reference.to);
    if (!fs.existsSync(livePath)) {
      errors.push(
        reference.to +
          ' is declared in the installation map but does not exist in this repository.',
      );
      continue;
    }
    const content = fs.readFileSync(livePath, 'utf8');
    for (const [label, pattern] of controls) {
      if (!pattern.test(content)) errors.push(reference.to + ' is missing ' + label);
    }
    for (const forbidden of FORBIDDEN_PLACEHOLDERS) {
      if (content.includes(forbidden)) {
        errors.push(reference.to + ' contains forbidden placeholder ' + forbidden);
      }
    }
    checked.push({ workflow: reference.to, controls: controls.length });
  }
  return { errors, checked };
}

function runCli() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(
      'Usage: node verify-workflow-controls.mjs [--package-root DIR] [--repo-root DIR]\n',
    );
    return;
  }
  const { errors, checked } = verifyWorkflowControls(options);
  if (errors.length) {
    for (const error of errors) process.stderr.write('WORKFLOW CONTROL ERROR: ' + error + '\n');
    process.exitCode = 1;
    return;
  }
  const total = checked.reduce((sum, entry) => sum + entry.controls, 0);
  process.stdout.write(
    `Live workflows carry the required Engineering OS 5.0 controls (${total} across ${checked.length} workflows).\n`,
  );
}

const selfPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === selfPath) runCli();
