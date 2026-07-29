#!/usr/bin/env node
// Zeus 5: show which reasoning methods the request selects, and why.
//
// Zeus 4 routed domain modules but never selected a method, so reasoning depth
// was left implicit. This makes the selection inspectable and testable.
import { readFileSync } from 'node:fs';
import { route, selectMethods, methodRegistry, normalise } from './lib/zeus-engine.mjs';

const a = process.argv.slice(2);
const val = (n, d = null) => {
  const i = a.indexOf(`--${n}`);
  return i >= 0 ? a[i + 1] : d;
};

if (a.includes('--list')) {
  const family = val('family');
  const rows = methodRegistry.methods
    .filter((m) => !family || m.family === family)
    .map(
      (m) =>
        `${m.label.padEnd(20)} ${m.family.padEnd(8)} ${m.scopes.join(',').padEnd(18)} ${m.effect}`,
    );
  console.log(
    `${methodRegistry.total} methods (${methodRegistry.distinctBehaviours} distinct behaviours, rest are aliases)\n`,
  );
  console.log(rows.join('\n'));
  process.exit(0);
}

const task = (val('task') ?? readFileSync(0, 'utf8')).trim();
if (!task) {
  console.error(
    'Usage: zeus method --task "..." [--format json] | zeus method --list [--family think]',
  );
  process.exit(2);
}

const routed = route(task);
const selected = selectMethods(task, routed);
const byLabel = (label) => methodRegistry.methods.find((m) => m.label === label);
const s = normalise(task);

const explain = (label, role) => {
  const m = byLabel(label);
  if (!m) return { label, role, reason: 'unknown method' };
  const hits = (m.triggers ?? []).filter((t) => s.includes(normalise(t)));
  return {
    label,
    role,
    family: m.family,
    effect: m.effect,
    reason: hits.length
      ? `triggered by ${hits.slice(0, 3).join(', ')}`
      : role === 'risk-mandated'
        ? `mandated at risk ${routed.risk}`
        : `default for mode ${routed.mode}`,
  };
};

const mandated = new Set(methodRegistry.riskMandated[routed.risk] ?? []);
const result = {
  version: '5.0.0',
  task: task.slice(0, 320),
  mode: routed.mode,
  risk: routed.risk,
  tier: routed.tier,
  scopes: selected.scopes,
  stack: [
    explain(selected.primary, 'primary'),
    ...selected.supporting.map((l) => explain(l, mandated.has(l) ? 'risk-mandated' : 'supporting')),
    ...selected.formatting.map((l) => explain(l, 'formatting')),
  ],
  excluded: {
    note: 'Scope gating keeps marketing and learning methods away from engineering defects.',
    scopesConsidered: selected.scopes,
  },
};

if (val('format') === 'json') {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(`Task mode ${result.mode}, risk ${result.risk}, tier ${result.tier}`);
  console.log(`Scopes: ${result.scopes.join(', ')}\n`);
  for (const step of result.stack) {
    console.log(`${step.role.padEnd(14)} ${step.label.padEnd(20)} ${step.reason}`);
    console.log(`${''.padEnd(35)} ${step.effect ?? ''}`);
  }
}
