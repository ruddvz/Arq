#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const REQUIRED_LOCAL_AUTHORITIES = [
  'fourAxisClassification',
  'contextBudgets',
  'invariants',
  'sourceAuthority',
  'evidenceStates',
  'reviewAndGateSemantics',
  'graphVocabulary',
  'persistenceRules',
  'engineeringOsReleaseAuthority',
];

const REQUIRED_FORBIDDEN = [
  'active-claims',
  'locks',
  'project-truth',
  'evidence-conclusions',
  'risk-classifications',
  'release-authority',
  'secrets',
  'foreign-learned-project-doctrine',
];

export function validateAutonomy(value) {
  const errors = [];

  if (value?.protocol !== 'harness-autonomy/v1') {
    errors.push('protocol must be harness-autonomy/v1');
  }
  if (value?.harness !== 'ZEUS') {
    errors.push('harness must be ZEUS');
  }
  if (value?.project !== 'Arq') {
    errors.push('project must be Arq');
  }
  if (value?.repository !== 'ruddvz/Arq') {
    errors.push('repository must be ruddvz/Arq');
  }
  if (value?.runtimeDependenciesOnPeers !== false) {
    errors.push('runtimeDependenciesOnPeers must remain false');
  }
  if (value?.sharedMutableState !== false) {
    errors.push('sharedMutableState must remain false');
  }
  if (value?.federation?.mode !== 'reviewed-knowledge-only') {
    errors.push('federation mode must remain reviewed-knowledge-only');
  }

  for (const key of REQUIRED_LOCAL_AUTHORITIES) {
    if (value?.localAuthority?.[key] !== true) {
      errors.push(`localAuthority.${key} must remain true`);
    }
  }

  const forbidden = new Set(value?.federation?.forbidden ?? []);
  for (const item of REQUIRED_FORBIDDEN) {
    if (!forbidden.has(item)) {
      errors.push(`federation must forbid ${item}`);
    }
  }

  if (value?.graph?.dynamicOrInferredEdgesAreAdvisory !== true) {
    errors.push('dynamic or inferred graph edges must remain advisory');
  }
  if (value?.fallback !== 'canonical-zeus-engineering-os-workflow') {
    errors.push('fallback must remain canonical-zeus-engineering-os-workflow');
  }

  return errors;
}

export function validateAutonomyFiles(root = process.cwd()) {
  const errors = [];

  for (const rel of ['.zeus/AUTONOMY.md', '.zeus/autonomy.json']) {
    if (!existsSync(join(root, rel))) {
      errors.push(`missing ${rel}`);
    }
  }
  if (errors.length) {
    return errors;
  }

  try {
    errors.push(
      ...validateAutonomy(
        JSON.parse(readFileSync(join(root, '.zeus/autonomy.json'), 'utf8')),
      ),
    );
  } catch (error) {
    errors.push(`autonomy.json parse failed: ${error.message}`);
  }

  const agents = existsSync(join(root, 'AGENTS.md'))
    ? readFileSync(join(root, 'AGENTS.md'), 'utf8')
    : '';
  if (!agents.includes('.zeus/AUTONOMY.md')) {
    errors.push(
      'AGENTS.md must conditionally route federation work through .zeus/AUTONOMY.md',
    );
  }

  return errors;
}

function main() {
  const errors = validateAutonomyFiles();
  if (errors.length) {
    console.error(
      'ZEUS autonomy verify failed:\n' + errors.map((x) => `- ${x}`).join('\n'),
    );
    process.exit(1);
  }

  console.log('ZEUS autonomy verification passed.');
}

if (process.argv[1]?.endsWith('zeus-autonomy-verify.mjs')) {
  main();
}
