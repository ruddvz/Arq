#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, '../..');

function check(filePath, requirements) {
  const content = fs.readFileSync(filePath, 'utf8');
  const errors = [];
  for (const [label, pattern] of requirements) {
    if (!pattern.test(content)) errors.push(path.basename(filePath) + ' is missing ' + label);
  }
  for (const forbidden of ['REPLACE_' + 'AFTER_AUDIT', 'TODO_' + 'OWNER', 'TBD_' + 'OWNER']) {
    if (content.includes(forbidden))
      errors.push(path.basename(filePath) + ' contains forbidden placeholder ' + forbidden);
  }
  return errors;
}

const errors = [
  ...check(path.join(root, 'templates/.github/workflows/engineering-gate.v5.reference.yml'), [
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
  ]),
  ...check(path.join(root, 'templates/.github/workflows/deploy-pages.v5.fragment.yml'), [
    ['source and route verification', /pnpm arq:language:verify/],
    ['rendered artifact proof', /pnpm arq:language:site:build:verify/],
    ['commit-bound proof', /--commit "\$\{\{ github\.sha \}\}"/],
    ['live deployed verification', /pnpm arq:language:site:live:verify/],
    ['deployment output binding', /needs\.deploy\.outputs\.page_url/],
  ]),
];

if (errors.length) {
  for (const error of errors) process.stderr.write('WORKFLOW TEMPLATE ERROR: ' + error + '\n');
  process.exitCode = 1;
} else {
  process.stdout.write('Workflow templates contain the required Engineering OS 5.0 controls.\n');
}
