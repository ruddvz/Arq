import { describe, expect, it } from 'vitest';
import { createOpening, length, openingId, wallId } from '@arq/bim-core';
import { validateOpeningOverlaps } from './opening-overlap-validation';

const baseInput = {
  id: openingId('o-1'),
  hostWallId: wallId('w-1'),
  kind: 'door' as const,
  offsetFromWallStart: length(500, 'mm'),
  width: length(900, 'mm'),
  sillHeight: length(0, 'mm'),
  height: length(2100, 'mm'),
};

describe('validateOpeningOverlaps', () => {
  it('returns no messages when nothing overlaps', () => {
    const a = createOpening(baseInput);
    expect(validateOpeningOverlaps([a])).toEqual([]);
  });

  it('returns an error-severity message naming both openings when two overlap', () => {
    const a = createOpening(baseInput);
    const b = createOpening({
      ...baseInput,
      id: openingId('o-2'),
      offsetFromWallStart: length(1000, 'mm'),
    });
    const messages = validateOpeningOverlaps([a, b]);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.severity).toBe('error');
    expect(messages[0]?.code).toBe('OPENING_OVERLAP');
    expect(messages[0]?.affectedElementIds).toEqual([a.id, b.id]);
  });

  it('does not flag openings that only touch end-to-end (adversarial: two openings touching, blueprint section 42)', () => {
    const a = createOpening(baseInput);
    const b = createOpening({
      ...baseInput,
      id: openingId('o-2'),
      offsetFromWallStart: length(1400, 'mm'),
    });
    expect(validateOpeningOverlaps([a, b])).toEqual([]);
  });

  it('does not flag openings on different host walls', () => {
    const a = createOpening(baseInput);
    const b = createOpening({ ...baseInput, id: openingId('o-2'), hostWallId: wallId('w-2') });
    expect(validateOpeningOverlaps([a, b])).toEqual([]);
  });

  it('returns one message per overlapping pair among three openings', () => {
    const a = createOpening({ ...baseInput, offsetFromWallStart: length(0, 'mm'), width: length(1000, 'mm') });
    const b = createOpening({
      ...baseInput,
      id: openingId('o-2'),
      offsetFromWallStart: length(500, 'mm'),
      width: length(1000, 'mm'),
    });
    const c = createOpening({
      ...baseInput,
      id: openingId('o-3'),
      offsetFromWallStart: length(900, 'mm'),
      width: length(1000, 'mm'),
    });
    // a overlaps b, b overlaps c, a and c also overlap (900 < 1000+1000 span) - three pairs total.
    const messages = validateOpeningOverlaps([a, b, c]);
    expect(messages).toHaveLength(3);
    expect(messages.every((message) => message.severity === 'error')).toBe(true);
  });
});
