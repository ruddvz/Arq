import assert from 'node:assert/strict';
import { validateAutonomy } from './zeus-autonomy-verify.mjs';

const valid = () => ({
  protocol: 'harness-autonomy/v1',
  harness: 'ZEUS',
  project: 'Arq',
  repository: 'ruddvz/Arq',
  localAuthority: {
    fourAxisClassification: true,
    contextBudgets: true,
    invariants: true,
    sourceAuthority: true,
    evidenceStates: true,
    reviewAndGateSemantics: true,
    graphVocabulary: true,
    persistenceRules: true,
    engineeringOsReleaseAuthority: true,
  },
  runtimeDependenciesOnPeers: false,
  sharedMutableState: false,
  federation: {
    mode: 'reviewed-knowledge-only',
    forbidden: [
      'active-claims',
      'locks',
      'project-truth',
      'evidence-conclusions',
      'risk-classifications',
      'release-authority',
      'secrets',
      'foreign-learned-project-doctrine',
    ],
  },
  graph: { dynamicOrInferredEdgesAreAdvisory: true },
  fallback: 'canonical-zeus-engineering-os-workflow',
});

const fail = (mutate, pattern) => {
  const value = valid();
  mutate(value);
  assert.match(validateAutonomy(value).join('\n'), pattern);
};

assert.deepEqual(validateAutonomy(valid()), []);
fail((v) => {
  v.runtimeDependenciesOnPeers = true;
}, /runtimeDependenciesOnPeers must remain false/);
fail((v) => {
  v.sharedMutableState = true;
}, /sharedMutableState must remain false/);
fail((v) => {
  v.federation.mode = 'central-control';
}, /reviewed-knowledge-only/);
fail((v) => {
  v.localAuthority.fourAxisClassification = false;
}, /fourAxisClassification must remain true/);
fail((v) => {
  v.localAuthority.evidenceStates = false;
}, /evidenceStates must remain true/);
fail((v) => {
  v.localAuthority.engineeringOsReleaseAuthority = false;
}, /engineeringOsReleaseAuthority must remain true/);
fail((v) => {
  v.federation.forbidden = v.federation.forbidden.filter(
    (x) => x !== 'risk-classifications',
  );
}, /must forbid risk-classifications/);
fail((v) => {
  v.federation.forbidden = v.federation.forbidden.filter(
    (x) => x !== 'release-authority',
  );
}, /must forbid release-authority/);
fail((v) => {
  v.graph.dynamicOrInferredEdgesAreAdvisory = false;
}, /dynamic or inferred graph edges must remain advisory/);
fail((v) => {
  v.fallback = 'global-harness';
}, /fallback must remain canonical-zeus-engineering-os-workflow/);

console.log('ZEUS autonomy mutation tests passed.');
