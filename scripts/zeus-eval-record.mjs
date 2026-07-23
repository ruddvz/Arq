#!/usr/bin/env node
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const get = (name, fallback = undefined) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const entry = {
  date: get('date', new Date().toISOString().slice(0, 10)),
  complexity: get('complexity'),
  lane: get('lane', 'unknown'),
  task: get('task'),
  outcome: get('outcome'),
  deliveryStop: get('delivery-stop', 'local-green'),
  rounds: Number(get('rounds', '0')),
  verified: get('verified', '').split('|').filter(Boolean),
  remaining: get('remaining', '').split('|').filter(Boolean),
};
const errors = [];
if (!new Set(['XS', 'S', 'M', 'L', 'XL']).has(entry.complexity)) errors.push('invalid complexity');
if (!new Set(['green', 'partial', 'blocked', 'failed', 'rolled_back']).has(entry.outcome))
  errors.push('invalid outcome');
if (!entry.task || entry.task.length > 180) errors.push('task required and <=180 chars');
if (!Number.isInteger(entry.rounds) || entry.rounds < 0 || entry.rounds > 20)
  errors.push('invalid rounds');
const serialized = JSON.stringify(entry);
if (/gh[pousr]_[A-Za-z0-9]{20,}|(?:secret|token|password|api[_-]?key)\s*[=:]/i.test(serialized))
  errors.push('entry appears to contain a secret');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(2);
}
const path = join(process.cwd(), '.zeus', 'eval-log.jsonl');
mkdirSync(dirname(path), { recursive: true });
appendFileSync(path, `${JSON.stringify(entry)}\n`, 'utf8');
console.log(`Recorded Zeus evaluation: ${entry.complexity} ${entry.outcome} — ${entry.task}`);
