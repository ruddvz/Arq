import { describe, expect, it } from 'vitest';
import {
  TOLERANCE_CLASSES,
  toleranceMicrometres,
  withinTolerance,
  planarMergeToleranceMm,
  type ToleranceClass,
} from './tolerance-classes';
import { canonicalLength, expectCanonicalLength } from './canonical-length';

const um = (value: number) => expectCanonicalLength(canonicalLength(value));

describe('tolerance classes', () => {
  it('defines every class with what it applies to and what it does not', () => {
    for (const definition of Object.values(TOLERANCE_CLASSES)) {
      expect(definition.appliesTo.length).toBeGreaterThan(0);
      expect(definition.doesNotApplyTo.length).toBeGreaterThan(0);
    }
  });

  it('keys every definition by its own id, so a lookup cannot return another class', () => {
    for (const [key, definition] of Object.entries(TOLERANCE_CLASSES)) {
      expect(definition.id).toBe(key);
    }
  });

  /**
   * Canonical equality is exactly zero rather than a small number. A non-zero
   * value here would reintroduce the approximate comparison that storing
   * integers exists to remove.
   */
  it('makes canonical equality exact', () => {
    expect(toleranceMicrometres('canonical-equality')).toBe(0);
    expect(withinTolerance(um(300_000), um(300_000), 'canonical-equality')).toBe(true);
    expect(withinTolerance(um(300_000), um(300_001), 'canonical-equality')).toBe(false);
  });

  it('separates the storage quantum from equality', () => {
    // The grid can represent a 1µm difference; that does not make two values
    // 1µm apart the same value.
    expect(toleranceMicrometres('storage-quantum')).toBe(1);
    expect(withinTolerance(um(0), um(1), 'canonical-equality')).toBe(false);
  });

  it('merges planar topology at a threshold above accumulated float error and below human precision', () => {
    expect(withinTolerance(um(0), um(10), 'planar-topology-merge')).toBe(true);
    expect(withinTolerance(um(0), um(11), 'planar-topology-merge')).toBe(false);
    expect(planarMergeToleranceMm()).toBe(0.01);
  });

  /**
   * The failure mode a single global epsilon produces: tuning one call site
   * silently changes the answer at another. Distinct values make that
   * impossible by construction.
   */
  it('gives topology merging and canonical equality different answers for the same pair', () => {
    const a = um(0);
    const b = um(5);

    expect(withinTolerance(a, b, 'planar-topology-merge')).toBe(true);
    expect(withinTolerance(a, b, 'canonical-equality')).toBe(false);
  });

  /**
   * Screen-space and source-derived classes have no single model-space value.
   * Substituting a plausible one would answer a question the caller did not ask.
   */
  it.each<ToleranceClass>(['inference-acquisition', 'import', 'rendering', 'operation-validation'])(
    'refuses to give %s a fixed model-space value',
    (id) => {
      expect(toleranceMicrometres(id)).toBeNull();
      expect(() => withinTolerance(um(0), um(1), id)).toThrow(/no fixed model-space value/);
    },
  );

  it('explains what the refused class is actually for, rather than only refusing', () => {
    expect(() => withinTolerance(um(0), um(1), 'inference-acquisition')).toThrow(/pointer/);
  });
});
