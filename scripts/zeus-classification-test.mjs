#!/usr/bin/env node
// Zeus 5: classification and routing regression cases.
//
// Every case in the fixture pins either a defect Zeus 4 actually had, or a
// guarantee Zeus 5 adds. Adding a trigger to a module or a method is cheap;
// this is what stops it from quietly changing an unrelated lane.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { compile, methodRegistry } from './lib/zeus-engine.mjs';

const packageRoot = dirname(dirname(new URL(import.meta.url).pathname));
const cases = JSON.parse(
  readFileSync(join(packageRoot, 'quality', 'fixtures', 'zeus-classification-cases.json'), 'utf8'),
);

const TIER_RANK = { fast: 0, standard: 1, deep: 2 };
const scopesOf = (label) => methodRegistry.methods.find((m) => m.label === label)?.scopes ?? [];

let failed = 0;
for (const c of cases) {
  const problems = [];
  const contract = compile(c.task);

  for (const [field, want] of Object.entries(c.expect ?? {})) {
    if (contract[field] !== want)
      problems.push(`${field}: expected "${want}", got "${contract[field]}"`);
  }
  if (c.tierAtMost && TIER_RANK[contract.tier] > TIER_RANK[c.tierAtMost])
    problems.push(`tier: expected at most "${c.tierAtMost}", got "${contract.tier}"`);
  for (const id of c.modulesInclude ?? [])
    if (!contract.modules.includes(id))
      problems.push(`modules: expected "${id}", got [${contract.modules.join(', ')}]`);
  for (const id of c.modulesExclude ?? [])
    if (contract.modules.includes(id)) problems.push(`modules: "${id}" must not be routed`);
  if (c.maxModules !== undefined && contract.modules.length > c.maxModules)
    problems.push(`modules: expected at most ${c.maxModules}, got ${contract.modules.length}`);
  if (c.maxContractChars !== undefined) {
    const size = JSON.stringify(contract).length;
    if (size > c.maxContractChars)
      problems.push(`contract size: expected at most ${c.maxContractChars}, got ${size}`);
  }
  for (const text of c.acceptanceIncludes ?? [])
    if (!contract.acceptance.includes(text)) problems.push(`acceptance: missing "${text}"`);

  const stack = [contract.methods.primary, ...contract.methods.supporting];
  for (const label of c.methodsInclude ?? [])
    if (!stack.includes(label))
      problems.push(`methods: expected "${label}", got [${stack.join(', ')}]`);
  for (const scope of c.methodScopesExclude ?? [])
    for (const label of stack)
      if (scopesOf(label).includes(scope) && scopesOf(label).length === 1)
        problems.push(`methods: "${label}" is ${scope}-only and must not be selected here`);

  if (problems.length) {
    failed++;
    console.error(`FAIL ${c.name}`);
    console.error(`     task: ${c.task}`);
    for (const p of problems) console.error(`     ${p}`);
  }
}

if (failed) {
  console.error(`\nZeus classification test failed: ${failed} of ${cases.length} cases.`);
  process.exit(1);
}
console.log(`Zeus classification test passed (${cases.length} cases).`);
