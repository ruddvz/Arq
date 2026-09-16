import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  validateReleaseManifest,
  validateReleasePolicy,
} from './lib/release-evidence-contract.mjs';

const policy = JSON.parse(
  readFileSync(new URL('../docs/release/ARQ-RELEASE-POLICY.v1.json', import.meta.url), 'utf8'),
) as any;
const REVISION = 'a'.repeat(40);
const ROLLBACK_REVISION = 'b'.repeat(40);

function evidenceForStage(stage: string): any[] {
  return policy.releaseStages[stage].requiredEvidenceClasses.map((evidenceClass: string) => ({
    id: `evidence-${evidenceClass}`,
    class: evidenceClass,
    state: 'verified',
    revision: REVISION,
    source: `ci://${evidenceClass}`,
    cached: false,
    ...(evidenceClass === 'human_device'
      ? { humanApprovalRef: 'human://browser-device-acceptance' }
      : {}),
  }));
}

function manifestForStage(stage: string): any {
  const evidence = evidenceForStage(stage);
  const manifest: any = {
    schemaVersion: 1,
    policyId: policy.policyId,
    releaseStage: stage,
    releaseRevision: REVISION,
    integrationAuthority: { branch: 'main', sha: REVISION },
    evidence,
    knownIssues: [],
    publicClaims: [],
  };
  if (policy.releaseStages[stage].requiredEvidenceClasses.includes('rollback_compatibility')) {
    manifest.rollback = {
      targetRevision: ROLLBACK_REVISION,
      projectFormatCompatibilityEvidenceId: 'evidence-rollback_compatibility',
    };
  }
  return manifest;
}

describe('release evidence contract', () => {
  it('accepts the canonical policy', () => {
    expect(validateReleasePolicy(policy)).toEqual({ ok: true, errors: [] });
  });

  it('accepts a complete exact-head stable manifest', () => {
    const result = validateReleaseManifest({
      policy,
      manifest: manifestForStage('stable'),
      expectedRevision: REVISION,
    });
    expect(result).toEqual({ ok: true, errors: [], blockers: [] });
  });

  it('blocks stale required evidence even when it previously passed', () => {
    const manifest = manifestForStage('internal');
    manifest.evidence.find((item: any) => item.class === 'build').revision = 'c'.repeat(40);
    const result = validateReleaseManifest({ policy, manifest, expectedRevision: REVISION });
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain(
      'required evidence class build has no exact-head verified receipt',
    );
  });

  it('rejects a manifest for a different release head', () => {
    const result = validateReleaseManifest({
      policy,
      manifest: manifestForStage('engineering'),
      expectedRevision: 'd'.repeat(40),
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('does not match expected exact head');
  });

  it('does not permit a release-stop P0 issue to be waived for architect alpha', () => {
    const manifest = manifestForStage('architect_alpha');
    manifest.knownIssues.push({
      issue: '#900',
      severity: 'P0',
      status: 'open',
      userImpact: 'Published project can lose semantic objects.',
      waiver: {
        approvedByRole: 'owner',
        approvalRef: 'decision://900',
        userImpact: 'Published project can lose semantic objects.',
      },
    });
    const result = validateReleaseManifest({ policy, manifest, expectedRevision: REVISION });
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('release-stop issue #900 cannot be waived in this contract');
    expect(result.blockers).toContain('open P0 release-stop issue #900 blocks architect_alpha');
  });

  it('requires an owner-approved waiver for a stable-blocking P2 issue', () => {
    const manifest = manifestForStage('stable');
    manifest.knownIssues.push({
      issue: '#901',
      severity: 'P2',
      status: 'open',
      userImpact: 'A major workflow requires a supported workaround.',
    });
    const blocked = validateReleaseManifest({ policy, manifest, expectedRevision: REVISION });
    expect(blocked.ok).toBe(false);
    expect(blocked.blockers).toContain(
      'open P2 issue #901 requires owner-approved waiver for stable',
    );

    manifest.knownIssues[0].waiver = {
      approvedByRole: 'owner',
      approvalRef: 'decision://901',
      userImpact: 'A major workflow requires a supported workaround.',
    };
    const waived = validateReleaseManifest({ policy, manifest, expectedRevision: REVISION });
    expect(waived).toEqual({ ok: true, errors: [], blockers: [] });
  });

  it('requires rollback compatibility evidence for external stages', () => {
    const manifest = manifestForStage('architect_alpha');
    manifest.rollback.projectFormatCompatibilityEvidenceId = 'missing-evidence';
    const result = validateReleaseManifest({ policy, manifest, expectedRevision: REVISION });
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain(
      'rollback project-format compatibility reference must point to exact-head verified rollback_compatibility evidence',
    );
  });

  it('requires human device approval to bind the release revision', () => {
    const manifest = manifestForStage('architect_alpha');
    delete manifest.evidence.find((item: any) => item.class === 'human_device').humanApprovalRef;
    const result = validateReleaseManifest({ policy, manifest, expectedRevision: REVISION });
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain(
      'human_device evidence requires a humanApprovalRef bound to the release revision',
    );
  });

  it('requires exact-head capability-ledger evidence before public claims', () => {
    const manifest = manifestForStage('engineering');
    manifest.publicClaims.push({ capabilityId: 'core.plan', claimRef: 'copy://plan' });
    const result = validateReleaseManifest({ policy, manifest, expectedRevision: REVISION });
    expect(result.ok).toBe(false);
    expect(result.blockers).toContain(
      'public claims require exact-head verified capability_ledger evidence',
    );
  });
});
