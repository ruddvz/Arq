import { readFileSync } from 'node:fs';
import path from 'node:path';

const FULL_GIT_SHA = /^[0-9a-f]{40}$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueStrings(values) {
  return (
    Array.isArray(values) && values.every(nonEmptyString) && new Set(values).size === values.length
  );
}

export function loadReleasePolicy(repoRoot = process.cwd()) {
  const policyPath = path.join(repoRoot, 'docs/release/ARQ-RELEASE-POLICY.v1.json');
  return JSON.parse(readFileSync(policyPath, 'utf8'));
}

export function validateReleasePolicy(policy) {
  const errors = [];

  if (!isObject(policy)) return { ok: false, errors: ['release policy must be an object'] };
  if (policy.schemaVersion !== 1) errors.push('release policy schemaVersion must be 1');
  if (!nonEmptyString(policy.policyId)) errors.push('release policy requires policyId');
  if (!Array.isArray(policy.evidenceStates) || !policy.evidenceStates.includes('verified')) {
    errors.push('release policy evidenceStates must include verified');
  }
  if (policy.greenEvidenceState !== 'verified') {
    errors.push('verified must be the only green evidence state');
  }

  const stages = isObject(policy.releaseStages) ? policy.releaseStages : {};
  const stageNames = Object.keys(stages);
  for (const requiredStage of ['engineering', 'internal', 'architect_alpha', 'beta', 'stable']) {
    if (!isObject(stages[requiredStage]))
      errors.push(`release policy is missing stage ${requiredStage}`);
  }
  for (const [stageName, stage] of Object.entries(stages)) {
    if (typeof stage.externalAudience !== 'boolean') {
      errors.push(`release stage ${stageName} requires externalAudience boolean`);
    }
    if (
      !uniqueStrings(stage.requiredEvidenceClasses) ||
      stage.requiredEvidenceClasses.length === 0
    ) {
      errors.push(`release stage ${stageName} requires unique requiredEvidenceClasses`);
    }
  }

  const severities = isObject(policy.severityPolicy) ? policy.severityPolicy : {};
  for (const severityName of ['P0', 'P1', 'P2', 'P3', 'P4']) {
    const severity = severities[severityName];
    if (!isObject(severity)) {
      errors.push(`release policy is missing bug severity ${severityName}`);
      continue;
    }
    if (severity.kind !== 'bug-severity') {
      errors.push(`${severityName} must be explicitly typed as bug-severity`);
    }
    if (!nonEmptyString(severity.meaning)) errors.push(`${severityName} requires a meaning`);
    if (typeof severity.releaseStop !== 'boolean')
      errors.push(`${severityName} requires releaseStop boolean`);
    if (typeof severity.agentWaivable !== 'boolean')
      errors.push(`${severityName} requires agentWaivable boolean`);
    if (!uniqueStrings(severity.blockedStages ?? [])) {
      errors.push(`${severityName} blockedStages must be unique stage names`);
    } else {
      for (const blockedStage of severity.blockedStages) {
        if (!stageNames.includes(blockedStage)) {
          errors.push(`${severityName} blocks unknown release stage ${blockedStage}`);
        }
      }
    }
  }

  for (const severityName of ['P0', 'P1']) {
    const severity = severities[severityName];
    if (isObject(severity) && (!severity.releaseStop || severity.agentWaivable)) {
      errors.push(`${severityName} must remain a non-agent-waivable release-stop severity`);
    }
  }

  const rules = isObject(policy.rules) ? policy.rules : {};
  for (const requiredTrueRule of [
    'exactHeadRequired',
    'knownIssueWaiverRequiresOwnerApproval',
    'rollbackRequiresProjectFormatCompatibilityEvidence',
    'capabilityPublicClaimsMustConsumeCapabilityLedger',
  ]) {
    if (rules[requiredTrueRule] !== true)
      errors.push(`release policy rule ${requiredTrueRule} must be true`);
  }
  if (rules.criticalEvidenceMayUseCache !== false) {
    errors.push('critical evidence must not be cache-eligible');
  }
  if (rules.openPullRequestMayCountAsMergedProductTruth !== false) {
    errors.push('open pull requests must not count as merged product truth');
  }
  if (rules.releaseStopIssueMayBeAgentWaived !== false) {
    errors.push('release-stop issues must not be agent-waivable');
  }

  return { ok: errors.length === 0, errors };
}

function currentVerifiedEvidence(evidence, releaseRevision) {
  return (
    evidence.state === 'verified' &&
    evidence.revision === releaseRevision &&
    evidence.cached !== true
  );
}

function ownerWaiverIsValid(waiver) {
  return (
    isObject(waiver) &&
    waiver.approvedByRole === 'owner' &&
    nonEmptyString(waiver.approvalRef) &&
    nonEmptyString(waiver.userImpact)
  );
}

export function validateReleaseManifest({ policy, manifest, expectedRevision = null }) {
  const errors = [];
  const policyResult = validateReleasePolicy(policy);
  if (!policyResult.ok) {
    return {
      ok: false,
      errors: policyResult.errors.map((error) => `policy: ${error}`),
      blockers: [],
    };
  }
  if (!isObject(manifest)) {
    return { ok: false, errors: ['release manifest must be an object'], blockers: [] };
  }

  if (manifest.schemaVersion !== 1) errors.push('release manifest schemaVersion must be 1');
  if (manifest.policyId !== policy.policyId) {
    errors.push(`release manifest policyId must equal ${policy.policyId}`);
  }
  const stage = policy.releaseStages[manifest.releaseStage];
  if (!stage) errors.push(`unknown release stage ${String(manifest.releaseStage)}`);

  if (!FULL_GIT_SHA.test(manifest.releaseRevision ?? '')) {
    errors.push('releaseRevision must be a lowercase 40-character git SHA');
  }
  if (expectedRevision !== null && manifest.releaseRevision !== expectedRevision) {
    errors.push(
      `releaseRevision ${String(manifest.releaseRevision)} does not match expected exact head ${expectedRevision}`,
    );
  }
  if (!isObject(manifest.integrationAuthority)) {
    errors.push('integrationAuthority is required');
  } else {
    if (!nonEmptyString(manifest.integrationAuthority.branch)) {
      errors.push('integrationAuthority.branch is required');
    }
    if (manifest.integrationAuthority.sha !== manifest.releaseRevision) {
      errors.push('integrationAuthority.sha must equal releaseRevision');
    }
  }

  const evidence = Array.isArray(manifest.evidence) ? manifest.evidence : [];
  if (!Array.isArray(manifest.evidence)) errors.push('evidence must be an array');
  const ids = new Set();
  for (const item of evidence) {
    if (!isObject(item)) {
      errors.push('every evidence item must be an object');
      continue;
    }
    if (!nonEmptyString(item.id)) {
      errors.push('every evidence item requires id');
    } else if (ids.has(item.id)) {
      errors.push(`duplicate evidence id ${item.id}`);
    } else {
      ids.add(item.id);
    }
    if (!nonEmptyString(item.class)) errors.push(`evidence ${String(item.id)} requires class`);
    if (!policy.evidenceStates.includes(item.state)) {
      errors.push(`evidence ${String(item.id)} has unknown evidence state ${String(item.state)}`);
    }
    if (!FULL_GIT_SHA.test(item.revision ?? '')) {
      errors.push(`evidence ${String(item.id)} requires a full git revision`);
    }
    if (!nonEmptyString(item.source)) errors.push(`evidence ${String(item.id)} requires source`);
  }

  const blockers = [];
  if (stage) {
    for (const requiredClass of stage.requiredEvidenceClasses) {
      const candidates = evidence.filter((item) => isObject(item) && item.class === requiredClass);
      const current = candidates.find((item) =>
        currentVerifiedEvidence(item, manifest.releaseRevision),
      );
      if (!current) {
        blockers.push(
          `required evidence class ${requiredClass} has no exact-head verified receipt`,
        );
        continue;
      }
      if (requiredClass === 'human_device' && !nonEmptyString(current.humanApprovalRef)) {
        blockers.push(
          'human_device evidence requires a humanApprovalRef bound to the release revision',
        );
      }
    }
  }

  const knownIssues = Array.isArray(manifest.knownIssues) ? manifest.knownIssues : [];
  if (!Array.isArray(manifest.knownIssues))
    errors.push('knownIssues must be an array when present');
  for (const issue of knownIssues) {
    if (!isObject(issue)) {
      errors.push('every known issue must be an object');
      continue;
    }
    const severity = policy.severityPolicy[issue.severity];
    if (!severity) {
      errors.push(
        `known issue ${String(issue.issue)} has unknown bug severity ${String(issue.severity)}`,
      );
      continue;
    }
    if (!nonEmptyString(issue.issue)) errors.push('known issue requires issue reference');
    if (!nonEmptyString(issue.userImpact))
      errors.push(`known issue ${String(issue.issue)} requires userImpact`);
    if (issue.status !== 'open' && issue.status !== 'closed') {
      errors.push(`known issue ${String(issue.issue)} status must be open or closed`);
      continue;
    }
    if (
      issue.status === 'closed' ||
      !stage ||
      !severity.blockedStages.includes(manifest.releaseStage)
    ) {
      continue;
    }
    if (severity.releaseStop) {
      if (issue.waiver !== undefined && issue.waiver !== null) {
        errors.push(`release-stop issue ${String(issue.issue)} cannot be waived in this contract`);
      }
      blockers.push(
        `open ${issue.severity} release-stop issue ${String(issue.issue)} blocks ${manifest.releaseStage}`,
      );
      continue;
    }
    if (!ownerWaiverIsValid(issue.waiver)) {
      blockers.push(
        `open ${issue.severity} issue ${String(issue.issue)} requires owner-approved waiver for ${manifest.releaseStage}`,
      );
    }
  }

  if (stage?.requiredEvidenceClasses.includes('rollback_compatibility')) {
    if (!isObject(manifest.rollback)) {
      blockers.push('rollback contract is required for this release stage');
    } else {
      if (!FULL_GIT_SHA.test(manifest.rollback.targetRevision ?? '')) {
        errors.push('rollback.targetRevision must be a full git SHA');
      }
      if (!nonEmptyString(manifest.rollback.projectFormatCompatibilityEvidenceId)) {
        blockers.push('rollback requires project-format compatibility evidence reference');
      } else {
        const rollbackEvidence = evidence.find(
          (item) => item.id === manifest.rollback.projectFormatCompatibilityEvidenceId,
        );
        if (
          !rollbackEvidence ||
          rollbackEvidence.class !== 'rollback_compatibility' ||
          !currentVerifiedEvidence(rollbackEvidence, manifest.releaseRevision)
        ) {
          blockers.push(
            'rollback project-format compatibility reference must point to exact-head verified rollback_compatibility evidence',
          );
        }
      }
    }
  }

  if (Array.isArray(manifest.publicClaims) && manifest.publicClaims.length > 0) {
    const ledgerEvidence = evidence.find(
      (item) =>
        item.class === 'capability_ledger' &&
        currentVerifiedEvidence(item, manifest.releaseRevision),
    );
    if (!ledgerEvidence) {
      blockers.push('public claims require exact-head verified capability_ledger evidence');
    }
    for (const claim of manifest.publicClaims) {
      if (
        !isObject(claim) ||
        !nonEmptyString(claim.capabilityId) ||
        !nonEmptyString(claim.claimRef)
      ) {
        errors.push('every public claim requires capabilityId and claimRef');
      }
    }
  }

  return { ok: errors.length === 0 && blockers.length === 0, errors, blockers };
}
