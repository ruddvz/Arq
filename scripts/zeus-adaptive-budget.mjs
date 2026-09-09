#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const coreConfigPath = path.join(root, '.zeus/config.json');
const adaptiveConfigPath = path.join(root, '.zeus/adaptive-cto.json');

export function loadConfigs() {
  return {
    core: JSON.parse(fs.readFileSync(coreConfigPath, 'utf8')),
    adaptive: JSON.parse(fs.readFileSync(adaptiveConfigPath, 'utf8')),
  };
}

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function validateAdaptiveConfig({ core, adaptive } = loadConfigs()) {
  const errors = [];
  if (core.mode !== adaptive.requiredCoreMode) {
    errors.push(`core mode must be ${adaptive.requiredCoreMode}`);
  }
  if (core.cache?.criticalEvidenceCache !== false) {
    errors.push('critical evidence cache must remain disabled');
  }

  for (const tier of ['fast', 'standard', 'deep']) {
    const base = core.budgets?.[tier];
    const extension = adaptive.budgetExtensions?.[tier];
    if (!base) {
      errors.push(`missing core budget tier: ${tier}`);
      continue;
    }
    if (!extension) {
      errors.push(`missing adaptive budget extension: ${tier}`);
      continue;
    }

    for (const key of [
      'modules',
      'sources',
      'contextChars',
      'repairRounds',
      'supportingMethods',
    ]) {
      if (!Number.isFinite(base[key]) || base[key] < 1) {
        errors.push(`${tier}.${key} must be a positive finite ceiling`);
      }
    }
    for (const key of [
      'toolCallsBeforeReevaluation',
      'externalResearchQueries',
      'parallelReadOnlyAgents',
      'parallelMutationLanes',
      'reviewerFanoutSoftCeiling',
    ]) {
      if (!Number.isFinite(extension[key]) || extension[key] < 0) {
        errors.push(`${tier}.${key} must be a non-negative finite ceiling`);
      }
    }
    if (extension.parallelMutationLanes !== 1) {
      errors.push(`${tier}.parallelMutationLanes must remain 1 for one owned mutation lane`);
    }
  }

  if (adaptive.valueOfInformation?.requiredBeforeExpansion !== true) {
    errors.push('value-of-information check must be required before budget expansion');
  }
  if (adaptive.valueOfInformation?.expansionReasonRequiredAtCeiling !== true) {
    errors.push('budget expansion must require an explicit reason');
  }
  if (adaptive.valueOfInformation?.protectedProofOverridesOrdinaryCeiling !== true) {
    errors.push('protected proof must be allowed to exceed ordinary soft ceilings');
  }
  if (adaptive.continualHarnessLifecycle?.storeHiddenReasoning !== false) {
    errors.push('continual harness must not store hidden reasoning');
  }
  if (adaptive.telemetry?.rawPrompt !== false || adaptive.telemetry?.hiddenReasoning !== false) {
    errors.push('telemetry must not retain raw prompts or hidden reasoning');
  }

  return { ok: errors.length === 0, errors };
}

export function mergedBudget(tier, configs = loadConfigs()) {
  const { core, adaptive } = configs;
  if (!core.budgets?.[tier] || !adaptive.budgetExtensions?.[tier]) {
    throw new Error(`Unknown Zeus tier: ${tier}`);
  }
  return { ...core.budgets[tier], ...adaptive.budgetExtensions[tier] };
}

export function adviseExpansion(
  { tier, category, used, expectedDecisionValue, protectedProof = false },
  configs = loadConfigs(),
) {
  const budget = mergedBudget(tier, configs);
  const ceiling = budget[category];
  if (!Number.isFinite(ceiling)) {
    throw new Error(`Unknown finite budget category for ${tier}: ${category}`);
  }
  if (!Number.isFinite(used) || used < 0) {
    throw new Error('used must be a non-negative number');
  }

  if (protectedProof) {
    return {
      allowed: true,
      reevaluate: used >= ceiling,
      reasonRequired: used >= ceiling,
      reason:
        used >= ceiling
          ? 'protected proof may exceed the ordinary ceiling, but the expansion reason must be recorded'
          : 'protected proof remains inside the ordinary ceiling',
    };
  }

  if (expectedDecisionValue !== true) {
    return {
      allowed: false,
      reevaluate: used >= ceiling,
      reasonRequired: false,
      reason: 'stop: additional work has no expected decision or proof value',
    };
  }

  if (used >= ceiling) {
    return {
      allowed: false,
      reevaluate: true,
      reasonRequired: true,
      reason: 'ceiling reached: re-evaluate tier, strategy and expansion reason before consuming more work',
    };
  }

  return {
    allowed: true,
    reevaluate: false,
    reasonRequired: false,
    reason: 'additional work has positive expected decision value and remains below the tier ceiling',
  };
}

export function operationFingerprint({
  kind,
  target = '',
  sourceFingerprint = '',
  purpose = '',
}) {
  return [kind, target, sourceFingerprint, purpose].map(normalize).join('|');
}

export function shouldReuseOperation({
  seen = new Set(),
  key,
  protectedEvidence = false,
  stateChanged = false,
}) {
  if (!key) throw new Error('operation key is required');
  if (protectedEvidence) {
    return { reuse: false, reason: 'protected Zeus evidence requires current proof' };
  }
  if (stateChanged) {
    return { reuse: false, reason: 'workspace/source fingerprint changed' };
  }
  if (seen.has(key)) {
    return {
      reuse: true,
      reason: 'fingerprint-valid evidence already exists for this operation',
    };
  }
  return { reuse: false, reason: 'no current reusable operation found' };
}

export function selectCapabilityClass({
  tier = 'fast',
  deterministic = false,
  independentReview = false,
  visualAcceptance = false,
  highUncertainty = false,
}) {
  if (deterministic) return 'deterministic-local';
  if (independentReview) return 'independent-review';
  if (visualAcceptance) return 'visual-browser-verification';
  if (tier === 'deep' || highUncertainty) return 'architecture-high-uncertainty';
  return 'routine-coding-reasoning';
}

export function shouldParallelize({
  independent,
  sharedDecision = false,
  sharedMutation = false,
  duplicatedContext = false,
  decisiveEvidenceAlreadyFound = false,
}) {
  if (decisiveEvidenceAlreadyFound) {
    return {
      parallel: false,
      reason: 'cancel redundant lane because decisive evidence already exists',
    };
  }
  if (!independent) {
    return { parallel: false, reason: 'work is not independently verifiable' };
  }
  if (sharedDecision) {
    return { parallel: false, reason: 'lanes depend on the same unresolved decision' };
  }
  if (sharedMutation) {
    return { parallel: false, reason: 'semantic state mutation remains one owned lane' };
  }
  if (duplicatedContext) {
    return {
      parallel: false,
      reason: 'parallelism would duplicate context loading rather than reduce work',
    };
  }
  return { parallel: true, reason: 'independent bounded work can converge safely' };
}

export function evaluateRunEfficiency({
  tier,
  usage = {},
  requiredCurrentHeadProof = false,
  configs = loadConfigs(),
}) {
  const budget = mergedBudget(tier, configs);
  const limits = {
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
  const actual = {
    modules: usage.modules ?? 0,
    sources: usage.sources ?? 0,
    contextChars: usage.contextChars ?? 0,
    supportingMethods: usage.supportingMethods ?? 0,
    toolCalls: usage.toolCalls ?? 0,
    externalResearchQueries: usage.externalResearchQueries ?? 0,
    readOnlyAgents: usage.readOnlyAgents ?? 0,
    mutationLanes: usage.mutationLanes ?? 0,
    repairRounds: usage.repairRounds ?? 0,
    reviewers: usage.reviewers ?? 0,
    duplicateOperationsSuppressed: usage.duplicateOperationsSuppressed ?? 0,
    duplicateOperationsExecuted: usage.duplicateOperationsExecuted ?? 0,
  };
  const exceeded = Object.entries(limits)
    .filter(([key, limit]) => Number.isFinite(limit) && actual[key] > limit)
    .map(([key]) => key);
  const qualityGreen =
    usage.requiredGatesPassed === true &&
    usage.requiredReviewPassed !== false &&
    usage.unresolvedHighRiskFinding !== true &&
    usage.evidenceState === 'verified' &&
    (!requiredCurrentHeadProof || usage.currentHeadProofPassed === true);
  const duplicateWaste = actual.duplicateOperationsExecuted > 0;
  const acceptanceProven = usage.acceptanceProven === true;

  return {
    tier,
    limits,
    actual,
    exceeded,
    within_budget: exceeded.length === 0,
    quality_green: qualityGreen,
    duplicate_waste_detected: duplicateWaste,
    efficient: qualityGreen && exceeded.length === 0 && !duplicateWaste,
    decision:
      acceptanceProven && qualityGreen
        ? 'stop-success'
        : exceeded.length > 0
          ? 're-evaluate-tier-or-strategy'
          : qualityGreen
            ? 'continue-only-if-acceptance-not-yet-proven'
            : 'repair-review-or-block',
  };
}

function parseArgs(argv) {
  const args = {
    validate: false,
    tier: null,
    category: null,
    used: null,
    decisionValue: null,
    protectedProof: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--validate') args.validate = true;
    else if (arg === '--tier') args.tier = argv[++index];
    else if (arg === '--category') args.category = argv[++index];
    else if (arg === '--used') args.used = Number(argv[++index]);
    else if (arg === '--decision-value') args.decisionValue = argv[++index] === 'yes';
    else if (arg === '--protected-proof') args.protectedProof = true;
    else if (arg === '--json') args.json = true;
  }
  return args;
}

function usage() {
  return `Zeus adaptive budget adviser\n\nUsage:\n  node scripts/zeus-adaptive-budget.mjs --validate\n  node scripts/zeus-adaptive-budget.mjs --tier fast --category sources --used 2 --decision-value yes\n  node scripts/zeus-adaptive-budget.mjs --tier deep --category toolCallsBeforeReevaluation --used 40 --decision-value yes --protected-proof\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.validate) {
    const result = validateAdaptiveConfig();
    if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else {
      process.stdout.write(
        result.ok
          ? 'Zeus adaptive CTO config: PASS\n'
          : `Zeus adaptive CTO config: FAIL\n${result.errors.map((error) => `- ${error}`).join('\n')}\n`,
      );
    }
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (!args.tier || !args.category || args.used === null || args.decisionValue === null) {
    process.stdout.write(usage());
    process.exitCode = 2;
    return;
  }

  const result = adviseExpansion({
    tier: args.tier,
    category: args.category,
    used: args.used,
    expectedDecisionValue: args.decisionValue,
    protectedProof: args.protectedProof,
  });
  process.stdout.write(
    args.json
      ? `${JSON.stringify(result, null, 2)}\n`
      : `${result.allowed ? 'ALLOW' : 'STOP'}: ${result.reason}\n`,
  );
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}
