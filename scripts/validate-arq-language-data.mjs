#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
/*
 * Installed layout: the package ships canonical data under 02-canonical/, the
 * repository stores it flat under docs/product/voice/ (snapshots keep their
 * subdirectory). Resolve both so this file stays byte-comparable with the
 * package source apart from this path adapter.
 */
const LANGUAGE_ROOT = resolve(flag('--language-root', join(ROOT, 'docs/product/voice')));
function locate(rel) {
  const compact = rel.replace(/^02-canonical\//, '');
  return (
    [join(LANGUAGE_ROOT, compact), join(LANGUAGE_ROOT, rel), join(ROOT, rel)].find(existsSync) ??
    join(LANGUAGE_ROOT, compact)
  );
}
let failures = 0;
const fail = (message) => {
  failures += 1;
  console.error(`FAIL ${message}`);
};
const pass = (message) => console.log(`PASS ${message}`);
const read = (rel) => JSON.parse(readFileSync(locate(rel), 'utf8'));
const exists = (rel) => existsSync(locate(rel));
function unique(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) fail(`duplicate ${label}: ${item}`);
    seen.add(item);
  }
}
function nonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a non-empty string`);
}

const requiredFiles = [
  '02-canonical/system-map.json',
  '02-canonical/context-contract.json',
  '02-canonical/snapshot-index.json',
  '02-canonical/product-ontology.json',
  '02-canonical/state-language-map.json',
  '02-canonical/ui-state-adapter-map.json',
  '02-canonical/roles-permissions.json',
  '02-canonical/format-language-map.json',
  '02-canonical/claim-registry.json',
  '02-canonical/claim-binding-registry.json',
  '02-canonical/conflict-registry.json',
  '02-canonical/answerability-policy.json',
  '02-canonical/response-disposition-policy.json',
  '02-canonical/message-contract.json',
  '02-canonical/editorial-authenticity-policy.json',
  '02-canonical/public-copy-inventory.json',
  '02-canonical/deployed-site-contract.json',
  '02-canonical/integration-contract.json',
  '02-canonical/language-contract-version.json',
  '02-canonical/source-registry.json',
  '02-canonical/dependency-map.json',
  '02-canonical/surface-contracts.json',
  '02-canonical/support-intents.json',
  '02-canonical/knowledge-domain-map.json',
];
for (const file of requiredFiles) if (!exists(file)) fail(`missing canonical file ${file}`);
if (failures) process.exit(1);

const system = read('02-canonical/system-map.json');
if (
  system.schemaVersion !== 4 ||
  system.version !== '4.1.0' ||
  system.contractVersion !== '4.1.0'
) {
  fail('system map must declare language system 4.1.0 / schema 4');
} else pass('system map version and contract version');

const contextContract = read('02-canonical/context-contract.json');
if (contextContract.contextSchemaVersion !== 4)
  fail('context contract must require context schema 4');
const sourceSets = contextContract.sourceSets ?? [];
unique(
  sourceSets.map((x) => x.id),
  'source-set id',
);
unique(
  sourceSets.map((x) => x.path),
  'source-set path',
);
for (const source of sourceSets) {
  nonEmptyString(source.id, 'source-set id');
  nonEmptyString(source.path, `source-set ${source.id} path`);
  if (source.path.startsWith('/') || source.path.includes('..'))
    fail(`source-set ${source.id} has unsafe path`);
  if (!['file', 'directory'].includes(source.kind))
    fail(`source-set ${source.id} has invalid kind`);
  if (typeof source.required !== 'boolean') fail(`source-set ${source.id} must declare required`);
}
pass(`${sourceSets.length} source sets declared`);

const sourceRegistry = read('02-canonical/source-registry.json');
const sourceIds = sourceRegistry.sources.map((x) => x.id);
unique(sourceIds, 'source registry id');
const sourceSetIds = new Set(sourceSets.map((x) => x.id));
for (const source of sourceRegistry.sources) {
  if (source.sourceSet !== 'none' && !sourceSetIds.has(source.sourceSet)) {
    fail(`source ${source.id} references unknown source set ${source.sourceSet}`);
  }
}
for (const [question, ids] of Object.entries(sourceRegistry.authorityByQuestion ?? {})) {
  for (const id of ids)
    if (!sourceIds.includes(id))
      fail(`authority question ${question} references unknown source ${id}`);
}
pass(`${sourceIds.length} canonical source identities`);

const snapshotIndex = read('02-canonical/snapshot-index.json');
unique(
  (snapshotIndex.snapshots ?? []).map((x) => x.id),
  'snapshot id',
);
unique(
  (snapshotIndex.snapshots ?? []).map((x) => x.path),
  'snapshot path',
);
for (const snapshot of snapshotIndex.snapshots ?? []) {
  if (!exists(snapshot.path)) fail(`snapshot missing ${snapshot.path}`);
}
const factsSnapshot = (snapshotIndex.snapshots ?? []).find((x) => x.kind === 'facts');
const interfaceSnapshotMeta = (snapshotIndex.snapshots ?? []).find((x) => x.kind === 'interface');
if (!factsSnapshot || !interfaceSnapshotMeta)
  fail('snapshot index needs one facts and one interface snapshot');
const facts = factsSnapshot ? read(factsSnapshot.path) : { facts: [] };
const interfaceSnapshot = interfaceSnapshotMeta ? read(interfaceSnapshotMeta.path) : {};
unique(
  (facts.facts ?? []).map((x) => x.id),
  'snapshot fact id',
);
unique(
  (interfaceSnapshot.tools ?? []).map((x) => x.id),
  'tool id',
);
unique(
  (interfaceSnapshot.tools ?? []).map((x) => x.name),
  'tool name',
);
unique(
  (interfaceSnapshot.workspaceSurfaces ?? []).map((x) => x.id),
  'workspace surface id',
);
unique(
  (interfaceSnapshot.routeSurfaces ?? []).map((x) => x.id),
  'route surface id',
);
if (!Object.keys(interfaceSnapshot.stateMachines ?? {}).length)
  fail('interface snapshot has no state machines');
pass('snapshot index and snapshot identities are valid without fixed product counts');

const ontology = read('02-canonical/product-ontology.json');
unique(
  (ontology.entities ?? []).map((x) => x.id),
  'ontology id',
);
unique(
  (ontology.entities ?? []).map((x) => x.canonical),
  'ontology canonical name',
);
pass(`${ontology.entities?.length ?? 0} ontology entities`);

const stateMap = read('02-canonical/state-language-map.json');
const policyMachines = new Set(Object.keys(stateMap.machinePolicies ?? {}));
for (const [machine, entries] of Object.entries(stateMap.machines ?? {})) {
  if (!Array.isArray(entries) || !entries.length) fail(`state machine ${machine} has no mappings`);
  unique(
    entries.map((x) => x.internal),
    `${machine} state`,
  );
  for (const entry of entries) {
    const hasLabel = typeof entry.label === 'string' && entry.label.trim();
    const hasTemplate = typeof entry.labelTemplate === 'string' && entry.labelTemplate.trim();
    if (hasLabel === hasTemplate)
      fail(`${machine}/${entry.internal} needs exactly one of label or labelTemplate`);
    if (!['product', 'diagnostic', 'internal'].includes(entry.exposure))
      fail(`${machine}/${entry.internal} has invalid exposure`);
    if (entry.exposure === 'product' && !(entry.explain || policyMachines.has(machine))) {
      fail(`${machine}/${entry.internal} needs an explanation or machine policy`);
    }
  }
}
pass(`${Object.keys(stateMap.machines ?? {}).length} mapped state machines`);

const roles = read('02-canonical/roles-permissions.json');
const roleIds = roles.roles.map((x) => x.id);
unique(roleIds, 'role id');
for (const [action, allowed] of Object.entries(roles.actions ?? {})) {
  for (const role of allowed)
    if (!roleIds.includes(role)) fail(`${action} references unknown role ${role}`);
}
pass(`${roleIds.length} roles and ${Object.keys(roles.actions ?? {}).length} permission actions`);

const formats = read('02-canonical/format-language-map.json');
unique(
  (formats.formats ?? []).map((x) => x.id),
  'format id',
);
unique(
  (formats.fidelityTerms ?? []).map((x) => x.id),
  'fidelity term',
);
pass(
  `${formats.formats?.length ?? 0} formats and ${formats.fidelityTerms?.length ?? 0} fidelity terms`,
);

const claims = read('02-canonical/claim-registry.json');
const claimStates = new Set(claims.states ?? []);
const claimIds = claims.claims.map((x) => x.id);
unique(claimIds, 'claim id');
for (const claim of claims.claims) {
  if (!claimStates.has(claim.state)) fail(`${claim.id} uses unknown claim state ${claim.state}`);
  if (!(claim.patterns ?? []).length) fail(`${claim.id} has no patterns`);
  if (!(claim.evidenceSourceIds ?? []).length) fail(`${claim.id} has no source identities`);
  for (const id of claim.evidenceSourceIds ?? [])
    if (!sourceIds.includes(id)) fail(`${claim.id} references unknown source ${id}`);
}
pass(`${claimIds.length} governed claims`);

const conflicts = read('02-canonical/conflict-registry.json');
const activeStatuses = new Set(conflicts.activeStatuses ?? []);
unique(
  (conflicts.conflicts ?? []).map((x) => x.id),
  'conflict id',
);
for (const conflict of conflicts.conflicts ?? []) {
  for (const id of conflict.sourceIds ?? [])
    if (!sourceIds.includes(id)) fail(`${conflict.id} references unknown source ${id}`);
  for (const id of conflict.affectedClaimIds ?? [])
    if (!claimIds.includes(id)) fail(`${conflict.id} references unknown claim ${id}`);
  if (activeStatuses.has(conflict.status) && !(conflict.resolution?.requires ?? []).length) {
    fail(`${conflict.id} needs resolution criteria`);
  }
}
for (const claim of claims.claims.filter((x) => x.state === 'CONFLICTED')) {
  if (!(claim.conflictIds ?? []).length) fail(`CONFLICTED claim ${claim.id} has no conflict ID`);
}
pass(`${conflicts.conflicts?.length ?? 0} conflict records`);

const messages = read('02-canonical/message-contract.json');
const messageIds = messages.messages.map((x) => x.id);
unique(messageIds, 'message id');
for (const message of messages.messages) {
  if (!(message.requiredSlots ?? []).length) fail(`${message.id} must declare required slots`);
  unique(message.requiredSlots ?? [], `${message.id} required slot`);
}
const adapters = read('02-canonical/ui-state-adapter-map.json');
unique(
  (adapters.adapters ?? []).map((x) => x.id),
  'state adapter id',
);
for (const adapter of adapters.adapters ?? []) {
  unique(
    (adapter.states ?? []).map((x) => x.internal),
    `${adapter.id} state`,
  );
  for (const state of adapter.states ?? []) {
    if (!messageIds.includes(state.canonicalMessageId))
      fail(`${adapter.id}/${state.internal} uses unknown message ID`);
    if (!['product', 'diagnostic', 'internal'].includes(state.exposure))
      fail(`${adapter.id}/${state.internal} has invalid exposure`);
  }
}
pass(
  `${messageIds.length} semantic messages and ${adapters.adapters?.length ?? 0} implementation adapters`,
);

const bindings = read('02-canonical/claim-binding-registry.json');
unique(
  (bindings.bindings ?? []).map((x) => x.id),
  'claim binding id',
);
for (const binding of bindings.bindings ?? []) {
  if (!claimIds.includes(binding.claimId))
    fail(`${binding.id} references unknown claim ${binding.claimId}`);
  if (!binding.sourcePath?.startsWith('apps/marketing/src/content/'))
    fail(`${binding.id} must bind a public content source path`);
}
pass(`${bindings.bindings?.length ?? 0} public claim bindings`);

const editorial = read('02-canonical/editorial-authenticity-policy.json');
if (editorial.policyVersion !== system.version)
  fail('editorial policy version must match system version');
unique(
  (editorial.categories ?? []).map((x) => x.id),
  'editorial category id',
);
for (const category of editorial.categories ?? []) {
  nonEmptyString(category.risk, `editorial category ${category.id} risk`);
  nonEmptyString(category.requiredReview, `editorial category ${category.id} required review`);
  if (!(category.lintRuleId || (category.lintRuleIds ?? []).length))
    fail(`editorial category ${category.id} needs a lint rule`);
}
const publicInventory = read('02-canonical/public-copy-inventory.json');
if (publicInventory.schemaVersion !== 2) fail('public-copy inventory must use schema 2');
unique(
  (publicInventory.entries ?? []).map((x) => x.id),
  'public-copy inventory id',
);
unique(
  (publicInventory.entries ?? []).map((x) => x.sourcePath),
  'public-copy inventory source path',
);
unique(
  (publicInventory.entries ?? []).map((x) => x.pageId),
  'public-copy inventory page ID',
);
unique(
  (publicInventory.entries ?? []).map((x) => x.route),
  'public-copy inventory route',
);
for (const entry of publicInventory.entries ?? []) {
  if (!['claim-bearing', 'non-claim'].includes(entry.classification))
    fail(`public-copy inventory ${entry.id} has invalid classification`);
  nonEmptyString(entry.pageId, `public-copy inventory ${entry.id} page ID`);
  nonEmptyString(entry.route, `public-copy inventory ${entry.id} route`);
  nonEmptyString(entry.owner, `public-copy inventory ${entry.id} owner`);
  if (entry.classification === 'claim-bearing' && !(entry.claimBindingIds ?? []).length)
    fail(`public-copy inventory ${entry.id} has no claim bindings`);
  if (entry.classification === 'non-claim')
    nonEmptyString(entry.nonClaimReason, `public-copy inventory ${entry.id} non-claim reason`);
}
const deployedSite = read('02-canonical/deployed-site-contract.json');
if (deployedSite.schemaVersion !== 1) fail('deployed-site contract must use schema 1');
if (deployedSite.policyVersion !== system.version)
  fail('deployed-site contract version must match system version');
for (const key of [
  'contentRoot',
  'routeMapPath',
  'routeRegistryPath',
  'staticOutputPath',
  'projectBasePath',
  'productionBaseUrl',
]) {
  nonEmptyString(deployedSite.repository?.[key], `deployed-site repository ${key}`);
}
for (const key of ['fileName', 'routeHashAlgorithm'])
  nonEmptyString(deployedSite.proof?.[key], `deployed-site proof ${key}`);
if (deployedSite.proof?.requiresCommitSha !== true)
  fail('deployed-site proof must require a commit SHA');
if (deployedSite.repository?.contentRoot !== publicInventory.contentRoot)
  fail('deployed-site content root must match public-copy inventory');
if (deployedSite.repository?.routeMapPath !== publicInventory.routeMapPath)
  fail('deployed-site route map must match public-copy inventory');
if (deployedSite.repository?.routeRegistryPath !== publicInventory.routeRegistryPath)
  fail('deployed-site route registry must match public-copy inventory');
const integration = read('02-canonical/integration-contract.json');
if (integration.version !== system.version)
  fail('integration contract version must match system version');
if (integration.schemaVersion !== 2) fail('integration contract must use schema 2');
unique(integration.requiredRepositoryFiles ?? [], 'integration repository file');
unique(integration.requiredScripts ?? [], 'integration package script');
pass(
  `${editorial.categories?.length ?? 0} editorial categories, ${publicInventory.entries?.length ?? 0} public-copy inventory entries and integration contract`,
);

const answerability = read('02-canonical/answerability-policy.json');
const requiredOutcomes = ['ANSWER', 'QUALIFY', 'CONFLICT', 'UNKNOWN', 'REFUSE_AUTHORITY'];
for (const outcome of requiredOutcomes)
  if (!(outcome in (answerability.states ?? {}))) fail(`answerability policy missing ${outcome}`);
const disposition = read('02-canonical/response-disposition-policy.json');
for (const outcome of requiredOutcomes) {
  if (!Array.isArray(disposition.answerabilityToAllowedDispositions?.[outcome]))
    fail(`disposition policy missing ${outcome}`);
}
pass('answerability and response-disposition policies');

const intents = read('02-canonical/support-intents.json');
unique(
  (intents.intents ?? []).map((x) => x.id),
  'support intent id',
);
const knowledge = read('02-canonical/knowledge-domain-map.json');
unique(
  (knowledge.domains ?? []).map((x) => x.id),
  'knowledge domain id',
);
const contractVersion = read('02-canonical/language-contract-version.json');
if (contractVersion.contractVersion !== '4.1.0') fail('language contract version must be 4.1.0');
for (const section of contractVersion.requiredContextSections ?? []) {
  if (
    ![
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
    ].includes(section)
  ) {
    fail(`language contract declares unknown required context section ${section}`);
  }
}
pass(
  `${intents.intents?.length ?? 0} support intents, ${knowledge.domains?.length ?? 0} knowledge domains and consumer contract`,
);

if (failures) {
  console.error(`\n${failures} canonical-data validation failure(s).`);
  process.exit(1);
}
console.log('\nCanonical data validation passed.');
