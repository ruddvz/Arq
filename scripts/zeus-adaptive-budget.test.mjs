import assert from 'node:assert/strict';
import {
  adviseExpansion,
  evaluateRunEfficiency,
  loadConfigs,
  mergedBudget,
  operationFingerprint,
  selectCapabilityClass,
  shouldParallelize,
  shouldReuseOperation,
  validateAdaptiveConfig,
} from './zeus-adaptive-budget.mjs';

const configs = loadConfigs();

{
  const result = validateAdaptiveConfig(configs);
  assert.equal(result.ok, true, result.errors.join('\n'));
}

{
  const budget = mergedBudget('fast', configs);
  assert.equal(budget.sources, 4);
  assert.equal(budget.contextChars, 8000);
  assert.equal(budget.toolCallsBeforeReevaluation, 8);
  assert.equal(budget.parallelMutationLanes, 1);
}

{
  const result = adviseExpansion(
    {
      tier: 'fast',
      category: 'sources',
      used: 1,
      expectedDecisionValue: false,
    },
    configs,
  );
  assert.equal(result.allowed, false);
  assert.match(result.reason, /no expected decision/i);
}

{
  const result = adviseExpansion(
    {
      tier: 'fast',
      category: 'sources',
      used: 2,
      expectedDecisionValue: true,
    },
    configs,
  );
  assert.equal(result.allowed, true);
  assert.equal(result.reevaluate, false);
}

{
  const result = adviseExpansion(
    {
      tier: 'fast',
      category: 'sources',
      used: 4,
      expectedDecisionValue: true,
    },
    configs,
  );
  assert.equal(result.allowed, false);
  assert.equal(result.reevaluate, true);
  assert.equal(result.reasonRequired, true);
}

{
  const result = adviseExpansion(
    {
      tier: 'deep',
      category: 'toolCallsBeforeReevaluation',
      used: 40,
      expectedDecisionValue: true,
      protectedProof: true,
    },
    configs,
  );
  assert.equal(result.allowed, true);
  assert.equal(result.reevaluate, true);
  assert.equal(result.reasonRequired, true);
}

{
  assert.equal(configs.core.cache.criticalEvidenceCache, false);
  assert.equal(configs.adaptive.continualHarnessLifecycle.storeHiddenReasoning, false);
  assert.equal(configs.adaptive.telemetry.rawPrompt, false);
  assert.equal(configs.adaptive.telemetry.hiddenReasoning, false);
}

{
  const key = operationFingerprint({
    kind: 'repository-read',
    target: 'semantic-model',
    sourceFingerprint: 'workspace-a',
    purpose: 'impact',
  });
  const seen = new Set([key]);
  assert.equal(shouldReuseOperation({ seen, key }).reuse, true);
  assert.equal(shouldReuseOperation({ seen, key, protectedEvidence: true }).reuse, false);
  assert.equal(shouldReuseOperation({ seen, key, stateChanged: true }).reuse, false);
}

{
  assert.equal(selectCapabilityClass({ tier: 'fast' }), 'routine-coding-reasoning');
  assert.equal(selectCapabilityClass({ tier: 'deep' }), 'architecture-high-uncertainty');
  assert.equal(
    selectCapabilityClass({ tier: 'fast', deterministic: true }),
    'deterministic-local',
  );
  assert.equal(
    selectCapabilityClass({ tier: 'standard', independentReview: true }),
    'independent-review',
  );
  assert.equal(
    selectCapabilityClass({ tier: 'standard', visualAcceptance: true }),
    'visual-browser-verification',
  );
}

{
  assert.equal(shouldParallelize({ independent: true }).parallel, true);
  assert.equal(
    shouldParallelize({ independent: true, sharedDecision: true }).parallel,
    false,
  );
  assert.equal(
    shouldParallelize({ independent: true, sharedMutation: true }).parallel,
    false,
  );
  assert.equal(
    shouldParallelize({ independent: true, duplicatedContext: true }).parallel,
    false,
  );
  assert.equal(
    shouldParallelize({ independent: true, decisiveEvidenceAlreadyFound: true }).parallel,
    false,
  );
}

{
  const result = evaluateRunEfficiency({
    tier: 'fast',
    configs,
    usage: {
      modules: 1,
      sources: 3,
      contextChars: 6000,
      supportingMethods: 1,
      toolCalls: 5,
      externalResearchQueries: 0,
      readOnlyAgents: 0,
      mutationLanes: 1,
      repairRounds: 1,
      reviewers: 1,
      duplicateOperationsSuppressed: 2,
      duplicateOperationsExecuted: 0,
      requiredGatesPassed: true,
      requiredReviewPassed: true,
      evidenceState: 'verified',
      acceptanceProven: true,
      unresolvedHighRiskFinding: false,
    },
  });
  assert.equal(result.within_budget, true);
  assert.equal(result.quality_green, true);
  assert.equal(result.efficient, true);
  assert.equal(result.decision, 'stop-success');
}

{
  const result = evaluateRunEfficiency({
    tier: 'fast',
    configs,
    usage: {
      modules: 1,
      sources: 3,
      contextChars: 6000,
      supportingMethods: 1,
      toolCalls: 5,
      mutationLanes: 1,
      duplicateOperationsExecuted: 1,
      requiredGatesPassed: true,
      requiredReviewPassed: true,
      evidenceState: 'verified',
      acceptanceProven: true,
    },
  });
  assert.equal(result.duplicate_waste_detected, true);
  assert.equal(result.efficient, false);
}

{
  const result = evaluateRunEfficiency({
    tier: 'fast',
    configs,
    usage: {
      modules: 1,
      sources: 5,
      contextChars: 6000,
      supportingMethods: 1,
      toolCalls: 5,
      mutationLanes: 1,
      requiredGatesPassed: true,
      requiredReviewPassed: true,
      evidenceState: 'verified',
      acceptanceProven: false,
    },
  });
  assert.equal(result.within_budget, false);
  assert.equal(result.exceeded.includes('sources'), true);
  assert.equal(result.decision, 're-evaluate-tier-or-strategy');
}

{
  const result = evaluateRunEfficiency({
    tier: 'deep',
    configs,
    requiredCurrentHeadProof: true,
    usage: {
      modules: 4,
      sources: 8,
      contextChars: 20000,
      supportingMethods: 2,
      toolCalls: 10,
      mutationLanes: 1,
      reviewers: 2,
      requiredGatesPassed: true,
      requiredReviewPassed: true,
      evidenceState: 'verified',
      currentHeadProofPassed: false,
      acceptanceProven: true,
    },
  });
  assert.equal(result.quality_green, false);
  assert.equal(result.decision, 'repair-review-or-block');
}

console.log('Zeus adaptive CTO budget tests: PASS');
