#!/usr/bin/env node
/** Assemble one versioned context for UI, support, documentation and product AI consumers. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const value = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const languageRoot = resolve(value('--language-root', join(PACKAGE_ROOT, 'docs/product/voice')));
function locate(rel) {
  const candidates = [
    join(languageRoot, rel),
    join(languageRoot, rel.replace(/^02-canonical\//, '')),
    join(PACKAGE_ROOT, rel),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Missing language context input: ${rel}`);
  return found;
}
const read = (rel) => JSON.parse(readFileSync(locate(rel), 'utf8'));
const system = read('02-canonical/system-map.json');
const snapshotIndex = read('02-canonical/snapshot-index.json');
const snapshot = (kind) => {
  const item = snapshotIndex.snapshots?.find((x) => x.kind === kind);
  if (!item) throw new Error(`Snapshot index missing ${kind} snapshot`);
  return { meta: item, data: read(item.path) };
};
const defaultOutput = join(languageRoot, 'language-context.json');
const output = resolve(value('--output', defaultOutput));
const repoContextArg = value('--repo-context', null);
const candidateRepoContext = repoContextArg
  ? resolve(repoContextArg)
  : join(languageRoot, 'generated-repo-context.json');
const repoContext = existsSync(candidateRepoContext)
  ? JSON.parse(readFileSync(candidateRepoContext, 'utf8'))
  : null;
if (repoContext && repoContext.schemaVersion !== 4)
  throw new Error('Live repo context must use schema 4');
const facts = snapshot('facts');
const interfaceSnapshot = snapshot('interface');
const context = {
  schemaVersion: 4,
  languageContractVersion: '4.1.0',
  generatedFrom: {
    packageVersion: system.version,
    snapshotIds: [facts.meta.id, interfaceSnapshot.meta.id],
    ...(repoContext
      ? {
          sourceSetDigest: repoContext.sourceSetDigest,
          sourceContractDigest: repoContext.sourceContractDigest,
        }
      : { mode: 'dated-package-snapshot' }),
  },
  snapshotWarning: repoContext
    ? null
    : 'This package context is a dated mirror. Refresh and verify live repository context before answering current-capability questions.',
  system,
  ontology: read('02-canonical/product-ontology.json'),
  terminology: read('02-canonical/terminology.json'),
  states: read('02-canonical/state-language-map.json'),
  stateAdapters: read('02-canonical/ui-state-adapter-map.json'),
  roles: read('02-canonical/roles-permissions.json'),
  formats: read('02-canonical/format-language-map.json'),
  aliases: read('02-canonical/term-aliases.json'),
  claims: read('02-canonical/claim-registry.json'),
  claimBindings: read('02-canonical/claim-binding-registry.json'),
  conflicts: read('02-canonical/conflict-registry.json'),
  errors: read('02-canonical/error-taxonomy.json'),
  supportIntents: read('02-canonical/support-intents.json'),
  sourceRegistry: read('02-canonical/source-registry.json'),
  contextContract: read('02-canonical/context-contract.json'),
  knowledgeDomains: read('02-canonical/knowledge-domain-map.json'),
  answerability: read('02-canonical/answerability-policy.json'),
  responseDisposition: read('02-canonical/response-disposition-policy.json'),
  messageContract: read('02-canonical/message-contract.json'),
  editorialAuthenticity: read('02-canonical/editorial-authenticity-policy.json'),
  publicCopyInventory: read('02-canonical/public-copy-inventory.json'),
  deployedSiteContract: read('02-canonical/deployed-site-contract.json'),
  consumerContract: read('02-canonical/language-contract-version.json'),
  surfaces: read('02-canonical/surface-contracts.json'),
  surfaceRegister: read('02-canonical/surface-register.json'),
  changeImpact: read('02-canonical/change-impact-map.json'),
  dependencies: read('02-canonical/dependency-map.json'),
  snapshotFacts: facts.data,
  snapshotInterface: interfaceSnapshot.data,
  repoContext,
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(context, null, 2)}\n`);
console.log(
  `Wrote ${output} (${repoContext ? 'live source digest included' : 'dated package snapshot'}).`,
);
