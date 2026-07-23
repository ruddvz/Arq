#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
const cmd = process.argv[2] ?? 'show';
const dir = join(process.cwd(), '.zeus', 'cache');
const file = join(dir, 'checks.json');
if (cmd === 'clear') {
  rmSync(file, { force: true });
  console.log('cleared');
} else if (cmd === 'show') {
  console.log(existsSync(file) ? readFileSync(file, 'utf8') : '{}');
} else {
  console.error('Usage: zeus-cache show|clear');
  process.exit(2);
}
