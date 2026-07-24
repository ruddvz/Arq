import { describe, expect, it } from 'vitest';
import { assertContextFresh, createContextFreshness } from './freshness';

describe('createContextFreshness', () => {
  it('is not stale when the indexed revision matches the project revision', () => {
    const freshness = createContextFreshness({
      projectRevision: 5,
      indexedRevision: 5,
      sourceIds: [],
      retrievalQuality: 'exact',
    });
    expect(freshness.staleWarning).toBe(false);
  });

  it('is stale when the indexed revision lags behind the project revision', () => {
    const freshness = createContextFreshness({
      projectRevision: 5,
      indexedRevision: 3,
      sourceIds: [],
      retrievalQuality: 'partial',
    });
    expect(freshness.staleWarning).toBe(true);
  });

  it('is stale when the active view revision lags, even if the index is current', () => {
    const freshness = createContextFreshness({
      projectRevision: 5,
      indexedRevision: 5,
      activeViewRevision: 4,
      sourceIds: [],
      retrievalQuality: 'exact',
    });
    expect(freshness.staleWarning).toBe(true);
  });

  it('is not stale when there is no active view revision to check', () => {
    const freshness = createContextFreshness({
      projectRevision: 5,
      indexedRevision: 5,
      sourceIds: [],
      retrievalQuality: 'exact',
    });
    expect(freshness.staleWarning).toBe(false);
  });
});

describe('assertContextFresh', () => {
  it('does not throw for fresh context', () => {
    expect(() =>
      assertContextFresh({
        projectRevision: 5,
        indexedRevision: 5,
        staleWarning: false,
        sourceIds: [],
        retrievalQuality: 'exact',
      }),
    ).not.toThrow();
  });

  it('throws naming the indexed and project revisions for stale context', () => {
    expect(() =>
      assertContextFresh({
        projectRevision: 5,
        indexedRevision: 3,
        staleWarning: true,
        sourceIds: [],
        retrievalQuality: 'partial',
      }),
    ).toThrow(/indexed 3, project 5/);
  });
});
