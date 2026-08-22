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
  '.zeus/evidence-ledger.schema.json',
  '.zeus/INVARIANTS.md',
  '.zeus/method-registry.json',
  '.zeus/blast-radius.json',
  'scripts/zeus.mjs',
  'scripts/zeus-fast-compile.mjs',
  'scripts/zeus-index.mjs',
  'scripts/zeus-context.mjs',
  'scripts/zeus-impact.mjs',
  'scripts/zeus-check.mjs',
  'scripts/zeus-benchmark.mjs',
  'scripts/zeus-method.mjs',
  'scripts/zeus-evidence.mjs',
  'scripts/zeus-validate.mjs',
  'scripts/zeus-hook.sh',
  'scripts/zeus-agent-registry.mjs',
  'scripts/zeus-harness-state.mjs',
  'scripts/zeus-gate-ledger.mjs',
  'scripts/zeus-reviewer-match.mjs',
  'scripts/zeus-drift-guard.mjs',
  '.claude/commands/zeus-refine.md',
  'AGENTS.md',
  '.cursor/rules/zeus-always-on.mdc',
  '.github/copilot-instructions.md',
];
const errors = [];
for (const f of required) if (!existsSync(join(root, f))) errors.push(`missing ${f}`);
try {
  const c = JSON.parse(readFileSync(join(root, '.zeus/config.json'), 'utf8'));
  if (c.version !== '5.0.0' || c.project !== 'Arq') errors.push('wrong config identity');
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
// CLAUDE.md and .claude/settings.json are deliberately not auto-created by the
// installer (INSTALL.md treats merging them as a manual, human-reviewed step so an
// existing CLAUDE.md or Claude settings file is never silently overwritten). They are
// not required for a fresh install to verify green, but if a repo has them, they must
// actually be wired correctly rather than silently broken.
if (existsSync(join(root, '.claude/settings.json'))) {
  try {
    const settings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
    const groups = settings.hooks?.UserPromptSubmit ?? [];
    const wired = groups.some((g) =>
      (g.hooks ?? []).some((h) => (h.command ?? '').includes('zeus-hook.sh')),
    );
    if (!wired) errors.push('.claude/settings.json does not wire UserPromptSubmit to zeus-hook.sh');
  } catch (e) {
    errors.push(`.claude/settings.json parse: ${e.message}`);
  }
}
const cursorRule = existsSync(join(root, '.cursor/rules/zeus-always-on.mdc'))
  ? readFileSync(join(root, '.cursor/rules/zeus-always-on.mdc'), 'utf8')
  : '';
if (!/alwaysApply:\s*true/.test(cursorRule))
  errors.push('.cursor/rules/zeus-always-on.mdc is missing alwaysApply: true');
if (errors.length) {
  console.error('Zeus verify failed:\n' + errors.map((x) => '- ' + x).join('\n'));
  process.exit(1);
}
console.log(`Zeus 5 verification passed (${required.length} required files).`);
