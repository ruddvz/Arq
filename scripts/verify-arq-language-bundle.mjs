#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const contextPath = resolve(
  value('--context', join(ROOT, 'docs/product/voice/language-context.json')),
);
if (!existsSync(contextPath)) {
  console.error(`FAIL language context missing: ${contextPath}`);
  process.exit(1);
}
const context = JSON.parse(readFileSync(contextPath, 'utf8'));
let failures = 0;
const fail = (m) => {
  failures += 1;
  console.error(`FAIL ${m}`);
};
if (context.schemaVersion !== 4 || context.languageContractVersion !== '4.1.0')
  fail('language context has wrong schema or contract version');
const required = context.consumerContract?.requiredContextSections ?? [
  'system',
  'states',
  'claims',
  'conflicts',
  'sources',
  'answerability',
  'responseDisposition',
  'messageContract',
  'stateAdapters',
  'editorialAuthenticity',
  'publicCopyInventory',
  'deployedSiteContract',
];
const keys = {
  system: 'system',
  states: 'states',
  claims: 'claims',
  conflicts: 'conflicts',
  sources: 'sourceRegistry',
  answerability: 'answerability',
  responseDisposition: 'responseDisposition',
  messageContract: 'messageContract',
  stateAdapters: 'stateAdapters',
  editorialAuthenticity: 'editorialAuthenticity',
  publicCopyInventory: 'publicCopyInventory',
  deployedSiteContract: 'deployedSiteContract',
};
for (const section of required)
  if (!(keys[section] in context) || !context[keys[section]])
    fail(`language context missing ${section}`);
if (context.repoContext !== null) {
  if (!context.repoContext.sourceSetDigest) fail('live language context has no source digest');
  if (context.snapshotWarning !== null)
    fail('live language context must not retain package-snapshot warning');
}
if (failures) process.exit(1);
console.log(
  `PASS language context contract (${context.repoContext ? 'live' : 'package snapshot'} mode).`,
);
