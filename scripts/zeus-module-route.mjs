#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { route } from './lib/zeus-engine.mjs';
const a = process.argv.slice(2);
const i = a.indexOf('--task');
const task = (i >= 0 ? a[i + 1] : process.stdin.isTTY ? '' : readFileSync(0, 'utf8')).trim();
if (!task) {
  console.error('Provide --task or stdin');
  process.exit(2);
}
console.log(JSON.stringify(route(task), null, 2));
