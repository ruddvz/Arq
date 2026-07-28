#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyEngineeringContext } from './build-engineering-context.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(scriptDirectory, '../..');
const options = { root: defaultRoot };
for (let index = 0; index < process.argv.slice(2).length; index += 1) {
  const argv = process.argv.slice(2);
  if (argv[index] === '--root') {
    options.root = argv[index + 1];
    index += 1;
  } else if (argv[index] === '--repo-root') {
    options.repoRoot = argv[index + 1];
    index += 1;
  } else if (argv[index] === '--help') {
    process.stdout.write(
      'Usage: node verify-engineering-context.mjs [--root PACKAGE_ROOT] [--repo-root ARQ_REPOSITORY]\n',
    );
    process.exit(0);
  } else {
    throw new Error('Unknown argument: ' + argv[index]);
  }
}
const result = verifyEngineeringContext({ root: options.root, repoRoot: options.repoRoot });
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
if (!result.ok) process.exitCode = 1;
