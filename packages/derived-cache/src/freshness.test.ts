import { describe, expect, it } from 'vitest';
import { freshnessReason, isFresh } from './freshness';
import type { DerivedOutputMeta } from './types';

const CURRENT = { projectRevision: 5, semanticHash: 'h5', engineFingerprint: 'e1' };

function meta(overrides: Partial<DerivedOutputMeta> = {}): DerivedOutputMeta {
  return {
    projectId: 'p',
    projectRevision: 5,
    semanticHash: 'h5',
    outputRevision: 1,
    engineFingerprint: 'e1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    sourceElementIds: [],
    stale: false,
    computationTimeMs: 1,
    cacheHit: false,
    approximationLevel: 'cached-vector',
    ...overrides,
  };
}

describe('isFresh / freshnessReason', () => {
  it('is fresh when every current field matches and not marked stale', () => {
    expect(isFresh(meta(), CURRENT)).toBe(true);
    expect(freshnessReason(meta(), CURRENT)).toBeNull();
  });

  it('is stale when the engine fingerprint changed', () => {
    expect(freshnessReason(meta({ engineFingerprint: 'old' }), CURRENT)).toBe(
      'engine-fingerprint-changed',
    );
  });

  it('is stale when the semantic hash changed', () => {
    expect(freshnessReason(meta({ semanticHash: 'old' }), CURRENT)).toBe('semantic-hash-changed');
  });

  it('is stale when the project revision changed', () => {
    expect(freshnessReason(meta({ projectRevision: 1 }), CURRENT)).toBe('project-revision-changed');
  });

  it('reports a custom stale reason when explicitly marked stale', () => {
    expect(
      freshnessReason(meta({ stale: true, staleReason: 'manual invalidation' }), CURRENT),
    ).toBe('manual invalidation');
  });

  it('falls back to a generic stale reason when marked stale with no explanation', () => {
    expect(freshnessReason(meta({ stale: true }), CURRENT)).toBe('marked-stale');
  });

  it('checks engine fingerprint before semantic hash before revision, in that order', () => {
    expect(
      freshnessReason(
        meta({ engineFingerprint: 'old', semanticHash: 'old', projectRevision: 1 }),
        CURRENT,
      ),
    ).toBe('engine-fingerprint-changed');
  });
});
