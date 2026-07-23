#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const required = [
  '.zeus/FAST-KERNEL.md',
  '.zeus/ZEUS.md',
  '.zeus/module-manifest.json',
  '.zeus/config.json',
  '.zeus/compact-contract.schema.json',
  'scripts/zeus.mjs',
  'scripts/zeus-fast-compile.mjs',
  'scripts/zeus-index.mjs',
  'scripts/zeus-context.mjs',
  'scripts/zeus-impact.mjs',
  'scripts/zeus-check.mjs',
  'scripts/zeus-benchmark.mjs',
  'scripts/zeus-hook.sh',
  'AGENTS.md',
];
const errors = [];
for (const f of required) if (!existsSync(join(root, f))) errors.push(`missing ${f}`);
try {
  const c = JSON.parse(readFileSync(join(root, '.zeus/config.json'), 'utf8'));
  if (c.version !== '4.0.0' || c.project !== 'Arq') errors.push('wrong config identity');
  for (const t of ['fast', 'standard', 'deep'])
    if (!c.budgets?.[t]) errors.push(`missing budget ${t}`);
} catch (e) {
  errors.push(`config parse: ${e.message}`);
}
try {
  const m = JSON.parse(readFileSync(join(root, '.zeus/module-manifest.json'), 'utf8'));
  for (const x of m.modules)
    if (!existsSync(join(root, x.path))) errors.push(`missing module ${x.path}`);
} catch (e) {
  errors.push(`manifest parse: ${e.message}`);
}
const core = existsSync(join(root, '.zeus/FAST-KERNEL.md'))
  ? readFileSync(join(root, '.zeus/FAST-KERNEL.md'), 'utf8')
  : '';
for (const x of ['Context economy', 'Verification economy', 'Invalid operations'])
  if (!core.includes(x)) errors.push(`kernel missing ${x}`);
if (errors.length) {
  console.error('Zeus verify failed:\n' + errors.map((x) => '- ' + x).join('\n'));
  process.exit(1);
}
console.log(`Zeus 4 verification passed (${required.length} required files).`);
