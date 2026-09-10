import assert from 'node:assert/strict';
import { runtimeReceipt, startReceipt } from './zeus-adaptive-runtime.mjs';

const baseUsage = {
  modules: 1,
  sources: 2,
  contextChars: 4000,
  supportingMethods: 1,
  toolCalls: 3,
  externalResearchQueries: 0,
  readOnlyAgents: 0,
  mutationLanes: 1,
  repairRounds: 0,
  reviewers: 0,
  duplicateOperationsSuppressed: 1,
  duplicateOperationsExecuted: 0,
};

{
  const receipt = startReceipt({
    tier: 'fast',
    repositoryFingerprint: 'repo-a',
    sourceFingerprint: 'source-a',
    claimFingerprint: 'claim-a',
  });
  assert.equal(receipt.phase, 'start');
  assert.equal(receipt.decision, 'proceed');
  assert.deepEqual(receipt.verification_frontier, ['required-gates']);
}

{
  const receipt = runtimeReceipt({
    phase: 'finish',
    tier: 'fast',
    usage: baseUsage,
    verification: { 'required-gates': 'passed' },
    acceptanceProven: true,
  });
  assert.equal(receipt.decision, 'stop-success');
  assert.equal(receipt.efficient, true);
}

{
  const receipt = runtimeReceipt({
    phase: 'checkpoint',
    tier: 'fast',
    usage: baseUsage,
    verification: { 'required-gates': 'passed' },
    acceptanceProven: false,
  });
  assert.equal(receipt.decision, 'proceed');
}

{
  const receipt = runtimeReceipt({
    phase: 'finish',
    tier: 'fast',
    usage: { ...baseUsage, sources: 5 },
    verification: { 'required-gates': 'passed' },
    acceptanceProven: false,
  });
  assert.equal(receipt.decision, 're-evaluate-tier-or-evidence-plan');
  assert.equal(receipt.reason_codes.includes('budget-ceiling-exceeded'), true);
}

{
  const receipt = runtimeReceipt({
    phase: 'finish',
    tier: 'fast',
    usage: { ...baseUsage, duplicateOperationsExecuted: 1 },
    verification: { 'required-gates': 'passed' },
    acceptanceProven: true,
  });
  assert.equal(receipt.decision, 're-evaluate-tier-or-evidence-plan');
  assert.equal(receipt.efficient, false);
}

{
  const receipt = runtimeReceipt({
    phase: 'finish',
    tier: 'fast',
    usage: baseUsage,
    verification: { 'required-gates': 'failed' },
    acceptanceProven: true,
  });
  assert.equal(receipt.decision, 'repair');
  assert.equal(receipt.reason_codes.includes('executed-verification-failed'), true);
}

{
  const receipt = runtimeReceipt({
    phase: 'finish',
    tier: 'fast',
    usage: baseUsage,
    verification: { 'required-gates': 'not-executed' },
    acceptanceProven: true,
  });
  assert.equal(receipt.decision, 'block-external-evidence');
}

{
  const receipt = runtimeReceipt({
    phase: 'finish',
    tier: 'standard',
    usage: baseUsage,
    verification: {
      'required-gates': 'passed',
      'required-independent-review': 'not-executed',
    },
    requireIndependentReview: true,
    acceptanceProven: true,
  });
  assert.equal(receipt.decision, 'block-external-evidence');
}

{
  const receipt = runtimeReceipt({
    phase: 'finish',
    tier: 'deep',
    usage: { ...baseUsage, reviewers: 1 },
    verification: {
      'required-gates': 'passed',
      'current-head-proof': 'not-executed',
    },
    requireCurrentHeadProof: true,
    acceptanceProven: true,
  });
  assert.equal(receipt.decision, 'block-external-evidence');
}

{
  const receipt = runtimeReceipt({
    phase: 'finish',
    tier: 'deep',
    usage: { ...baseUsage, reviewers: 1 },
    verification: {
      'required-gates': 'passed',
      'protected-owner-approval': 'not-executed',
    },
    protectedApprovalRequired: true,
    acceptanceProven: true,
  });
  assert.equal(receipt.decision, 'block-external-evidence');
}

{
  const receipt = runtimeReceipt({
    phase: 'finish',
    tier: 'fast',
    usage: baseUsage,
    verification: { 'required-gates': 'passed' },
    acceptanceProven: true,
    authorityViolation: true,
  });
  assert.equal(receipt.decision, 'repair');
}

{
  const receipt = runtimeReceipt({
    phase: 'finish',
    tier: 'fast',
    usage: baseUsage,
    verification: { 'required-gates': 'passed' },
    acceptanceProven: true,
    evidencePromotedWithoutBasis: true,
  });
  assert.equal(receipt.decision, 'repair');
}

{
  const receipt = runtimeReceipt({
    phase: 'checkpoint',
    tier: 'fast',
    usage: baseUsage,
    verification: { 'required-gates': 'passed' },
    expansion: {
      category: 'sources',
      used: 4,
      expectedDecisionValue: true,
      protectedProof: true,
      reason: '',
    },
  });
  assert.equal(receipt.decision, 're-evaluate-tier-or-evidence-plan');
  assert.equal(receipt.reason_codes.includes('protected-expansion-reason-missing'), true);
}

{
  const receipt = runtimeReceipt({
    phase: 'checkpoint',
    tier: 'deep',
    usage: baseUsage,
    verification: { 'required-gates': 'passed' },
    expansion: {
      category: 'toolCallsBeforeReevaluation',
      used: 40,
      expectedDecisionValue: true,
      protectedProof: true,
      reason: 'current protected evidence is required for the gate',
    },
  });
  assert.equal(receipt.decision, 're-evaluate-tier-or-evidence-plan');
  assert.equal(receipt.reason_codes.includes('protected-expansion-reason-recorded'), true);
}

assert.throws(
  () =>
    runtimeReceipt({
      phase: 'finish',
      tier: 'fast',
      usage: baseUsage,
      verification: { 'required-gates': 'not-required' },
    }),
  /cannot be marked not-required/,
);

console.log('ZEUS adaptive runtime v2 tests: PASS');
