import { describe, expect, it } from 'vitest';
import {
  REPRESENTATION_NAMES,
  canUpgradeRepresentation,
  representationName,
} from './representation';

describe('representationName', () => {
  it('names every tier from bounding-box through export-quality', () => {
    expect(REPRESENTATION_NAMES).toEqual([
      'bounding-box',
      'simplified-plan',
      'cached-vector',
      'simplified-3d',
      'precise-active-view',
      'export-quality',
    ]);
    expect(representationName(0)).toBe('bounding-box');
    expect(representationName(5)).toBe('export-quality');
  });
});

describe('canUpgradeRepresentation', () => {
  it('allows moving to an equal or higher tier', () => {
    expect(canUpgradeRepresentation(1, 1)).toBe(true);
    expect(canUpgradeRepresentation(1, 3)).toBe(true);
  });

  it('refuses moving to a lower tier', () => {
    expect(canUpgradeRepresentation(3, 1)).toBe(false);
  });
});
