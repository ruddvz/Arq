import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { validateRoomPolygon } from './room-polygon-validation';

const points = (...pairs: readonly [number, number][]) => pairs.map(([x, y]) => worldPoint(x, y));

describe('validateRoomPolygon', () => {
  it('accepts a simple rectangle', () => {
    expect(validateRoomPolygon('r1', points([0, 0], [4000, 0], [4000, 3000], [0, 3000]))).toEqual(
      [],
    );
  });

  it('rejects fewer than three points', () => {
    const messages = validateRoomPolygon('r1', points([0, 0], [1000, 0]));
    expect(messages[0]?.code).toBe('ROOM_TOO_FEW_POINTS');
  });

  it('rejects collinear (zero-area) boundaries', () => {
    const messages = validateRoomPolygon('r1', points([0, 0], [1000, 0], [2000, 0]));
    expect(messages[0]?.code).toBe('ROOM_DEGENERATE_AREA');
  });

  it('rejects a self-intersecting (bow-tie) boundary', () => {
    const messages = validateRoomPolygon('r1', points([0, 0], [1000, 1000], [1000, 0], [0, 1000]));
    expect(messages[0]?.code).toBe('ROOM_SELF_INTERSECTING');
  });

  it('every message carries the §4.3 structure', () => {
    const messages = validateRoomPolygon('r1', points([0, 0]));
    for (const message of messages) {
      expect(message.title.length).toBeGreaterThan(0);
      expect(message.explanation).toContain('No change was applied');
      expect(message.suggestedActions.length).toBeGreaterThan(0);
      expect(message.affectedElementIds).toContain('r1');
    }
  });
});
