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

fail((value) => {
  value.runtimeDependenciesOnPeers = true;
}, /runtimeDependenciesOnPeers must remain false/);

fail((value) => {
  value.sharedMutableState = true;
}, /sharedMutableState must remain false/);

fail((value) => {
  value.federation.mode = 'central-control';
}, /reviewed-knowledge-only/);

fail((value) => {
  value.localAuthority.fourAxisClassification = false;
}, /fourAxisClassification must remain true/);

fail((value) => {
  value.localAuthority.evidenceStates = false;
}, /evidenceStates must remain true/);

fail((value) => {
  value.localAuthority.engineeringOsReleaseAuthority = false;
}, /engineeringOsReleaseAuthority must remain true/);

fail((value) => {
  value.federation.forbidden = value.federation.forbidden.filter(
    (item) => item !== 'risk-classifications',
  );
}, /must forbid risk-classifications/);

fail((value) => {
  value.federation.forbidden = value.federation.forbidden.filter(
    (item) => item !== 'release-authority',
  );
}, /must forbid release-authority/);

fail((value) => {
  value.graph.dynamicOrInferredEdgesAreAdvisory = false;
}, /dynamic or inferred graph edges must remain advisory/);

fail((value) => {
  value.fallback = 'global-harness';
}, /fallback must remain canonical-zeus-engineering-os-workflow/);

console.log('ZEUS autonomy mutation tests passed.');
