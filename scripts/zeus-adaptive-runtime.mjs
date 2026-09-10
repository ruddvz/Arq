#!/usr/bin/env node

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  adviseExpansion,
  evaluateRunEfficiency,
  loadConfigs,
  mergedBudget,
} from './zeus-adaptive-budget.mjs';

export const RUNTIME_SCHEMA = 'zeus-adaptive-runtime/v1';
export const VERIFICATION_STATES = new Set([
  'passed',
  'failed',
  'not-executed',
  'skipped',
  'not-required',
]);

const EXTERNAL_BLOCKING_CHECKS = new Set([
  'required-independent-review',
  'current-head-proof',
  'protected-owner-approval',
]);

function normaliseVerification(frontier, supplied = {}) {
  const states = {};
  for (const check of frontier) {
    const state = String(supplied[check] ?? 'not-executed');
    if (!VERIFICATION_STATES.has(state)) {
      throw new Error(`Unknown verification state for ${check}: ${state}`);
    }
    if (state === 'not-required') {
      throw new Error(`Required verification cannot be marked not-required: ${check}`);
    }
    states[check] = state;
  }
  return states;
}

function verificationFrontier({ tier, requireIndependentReview = false, requireCurrentHeadProof = false }) {
  const frontier = ['required-gates'];
  if (requireIndependentReview) frontier.push('required-independent-review');
  if (requireCurrentHeadProof || tier === 'deep') frontier.push('current-head-proof');
  return frontier;
}

function limits(tier, configs) {
  const budget = mergedBudget(tier, configs);
  return {
    modules: budget.modules,
    sources: budget.sources,
    contextChars: budget.contextChars,
    supportingMethods: budget.supportingMethods,
    toolCalls: budget.toolCallsBeforeReevaluation,
    externalResearchQueries: budget.externalResearchQueries,
    readOnlyAgents: budget.parallelReadOnlyAgents,
    mutationLanes: budget.parallelMutationLanes,
    repairRounds: budget.repairRounds,
    reviewers: budget.reviewerFanoutSoftCeiling,
  };
}

export function startReceipt({
  tier,
  repositoryFingerprint = '',
  sourceFingerprint = '',
  claimFingerprint = '',
  requireIndependentReview = false,
  requireCurrentHeadProof = false,
  configs = loadConfigs(),
}) {
  const frontier = verificationFrontier({
    tier,
    requireIndependentReview,
    requireCurrentHeadProof,
  });
  const verification = normaliseVerification(frontier);
  return {
    schema: RUNTIME_SCHEMA,
    phase: 'start',
    tier,
    repository_fingerprint: repositoryFingerprint,
    source_fingerprint: sourceFingerprint,
    claim_fingerprint: claimFingerprint,
    limits: limits(tier, configs),
    actual: {},
    verification_frontier: frontier,
    verification,
    duplicate_operations_suppressed: 0,
    duplicate_operations_executed: 0,
    expansion: null,
    decision: 'proceed',
    reason_codes: ['classified', 'bounded-work-authorised'],
  };
}

function expansionReceipt({ tier, expansion, configs }) {
  if (!expansion) return { receipt: null, reasonCodes: [] };
  const result = adviseExpansion(
    {
      tier,
      category: expansion.category,
      used: expansion.used,
      expectedDecisionValue: expansion.expectedDecisionValue === true,
      protectedProof: expansion.protectedProof === true,
    },
    configs,
  );
  const reason = String(expansion.reason ?? '').trim();
  const reasonCodes = [];
  if (result.reasonRequired && !reason) reasonCodes.push('protected-expansion-reason-missing');
  else if (!result.allowed) reasonCodes.push('expansion-not-authorised');
  else if (result.reasonRequired) reasonCodes.push('protected-expansion-reason-recorded');
  return {
    receipt: {
      category: expansion.category,
      used: expansion.used,
      expected_decision_value: expansion.expectedDecisionValue === true,
      protected_proof: expansion.protectedProof === true,
      reason: reason || null,
      allowed_by_base: result.allowed,
      reevaluate: result.reevaluate,
      reason_required: result.reasonRequired,
      base_reason: result.reason,
    },
    reasonCodes,
  };
}

export function runtimeReceipt({
  phase,
  tier,
  repositoryFingerprint = '',
  sourceFingerprint = '',
  claimFingerprint = '',
  usage = {},
  verification = {},
  acceptanceProven = false,
  authorityViolation = false,
  evidencePromotedWithoutBasis = false,
  requireIndependentReview = false,
  requireCurrentHeadProof = false,
  expansion = null,
  configs = loadConfigs(),
}) {
  if (!['checkpoint', 'finish'].includes(phase)) {
    throw new Error('runtime phase must be checkpoint or finish');
  }

  const frontier = verificationFrontier({
    tier,
    requireIndependentReview,
    requireCurrentHeadProof,
  });
  const states = normaliseVerification(frontier, verification);
  const failed = frontier.filter((check) => states[check] === 'failed');
  const unavailable = frontier.filter((check) => ['not-executed', 'skipped'].includes(states[check]));
  const externalUnavailable = unavailable.filter((check) => EXTERNAL_BLOCKING_CHECKS.has(check));
  const localUnavailable = unavailable.filter((check) => !EXTERNAL_BLOCKING_CHECKS.has(check));
  const allPassed = frontier.every((check) => states[check] === 'passed');

  const baseUsage = {
    ...usage,
    requiredGatesPassed: states['required-gates'] === 'passed',
    requiredReviewPassed: requireIndependentReview
      ? states['required-independent-review'] === 'passed'
      : true,
    evidenceState: allPassed ? 'verified' : 'unverified',
    currentHeadProofPassed: requireCurrentHeadProof
      ? states['current-head-proof'] === 'passed'
      : true,
    acceptanceProven,
  };
  const efficiency = evaluateRunEfficiency({
    tier,
    usage: baseUsage,
    requiredCurrentHeadProof: requireCurrentHeadProof,
    configs,
  });
  const expansionState = expansionReceipt({ tier, expansion, configs });
  const duplicateExecuted = Number(usage.duplicateOperationsExecuted ?? 0);
  const reasonCodes = [];

  if (authorityViolation) reasonCodes.push('authority-violation');
  if (evidencePromotedWithoutBasis) reasonCodes.push('unsupported-evidence-promotion');
  if (failed.length) reasonCodes.push('executed-verification-failed');
  if (localUnavailable.length) reasonCodes.push('required-verification-not-executed');
  if (externalUnavailable.length) reasonCodes.push('external-authority-or-current-proof-unavailable');
  if (efficiency.exceeded.length) reasonCodes.push('budget-ceiling-exceeded');
  if (duplicateExecuted > 0) reasonCodes.push('duplicate-work-executed');
  reasonCodes.push(...expansionState.reasonCodes);

  let decision;
  if (authorityViolation || evidencePromotedWithoutBasis || failed.length) decision = 'repair';
  else if (unavailable.length) decision = 'block-external-evidence';
  else if (expansionState.reasonCodes.length || efficiency.exceeded.length || duplicateExecuted > 0) {
    decision = 're-evaluate-tier-or-evidence-plan';
  } else if (phase === 'finish' && acceptanceProven && efficiency.quality_green) {
    decision = 'stop-success';
    reasonCodes.push('acceptance-proven');
  } else {
    decision = 'proceed';
    reasonCodes.push('more-work-still-has-acceptance-value');
  }

  return {
    schema: RUNTIME_SCHEMA,
    phase,
    tier,
    repository_fingerprint: repositoryFingerprint,
    source_fingerprint: sourceFingerprint,
    claim_fingerprint: claimFingerprint,
    limits: efficiency.limits,
    actual: efficiency.actual,
    verification_frontier: frontier,
    verification: states,
    quality_green: efficiency.quality_green,
    within_budget: efficiency.within_budget,
    efficient:
      decision === 'stop-success' &&
      efficiency.within_budget &&
      !efficiency.duplicate_waste_detected,
    duplicate_operations_suppressed: Number(usage.duplicateOperationsSuppressed ?? 0),
    duplicate_operations_executed: duplicateExecuted,
    expansion: expansionState.receipt,
    decision,
    reason_codes: [...new Set(reasonCodes)],
  };
}

function main() {
  const payload = JSON.parse(process.argv[2] ?? '{}');
  const result =
    payload.phase === 'start'
      ? startReceipt(payload)
      : runtimeReceipt(payload);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) main();
