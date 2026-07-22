import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import {
  createNumericOverlay,
  parseNumericOverlay,
  pointFromDistanceAndAngle,
  resolveNumericOverlayPoint,
} from './numeric-overlay';

describe('createNumericOverlay', () => {
  it('does nothing when typing without a focused field', () => {
    const overlay = createNumericOverlay();
    expect(overlay.typeChar('5')).toEqual({ field: null, distanceText: '', angleText: '' });
  });

  it('accumulates digits into the focused field only', () => {
    const overlay = createNumericOverlay();
    overlay.focusField('distance');
    overlay.typeChar('3');
    overlay.typeChar('5');
    overlay.typeChar('0');
    expect(overlay.snapshot()).toEqual({ field: 'distance', distanceText: '350', angleText: '' });
  });

  it('rejects a second decimal point', () => {
    const overlay = createNumericOverlay();
    overlay.focusField('distance');
    overlay.typeChar('1');
    overlay.typeChar('.');
    overlay.typeChar('5');
    overlay.typeChar('.');
    expect(overlay.snapshot().distanceText).toBe('1.5');
  });

  it('rejects a minus sign on the distance field but allows it on angle', () => {
    const overlay = createNumericOverlay();
    overlay.focusField('distance');
    overlay.typeChar('-');
    expect(overlay.snapshot().distanceText).toBe('');
    overlay.focusField('angle');
    overlay.typeChar('-');
    overlay.typeChar('4');
    overlay.typeChar('5');
    expect(overlay.snapshot().angleText).toBe('-45');
  });

  it('only allows the minus sign as the first character', () => {
    const overlay = createNumericOverlay();
    overlay.focusField('angle');
    overlay.typeChar('4');
    overlay.typeChar('-');
    expect(overlay.snapshot().angleText).toBe('4');
  });

  it('backspace removes the last character of the focused field', () => {
    const overlay = createNumericOverlay();
    overlay.focusField('distance');
    overlay.typeChar('1');
    overlay.typeChar('2');
    overlay.backspace();
    expect(overlay.snapshot().distanceText).toBe('1');
  });

  it('escape clears the focused field first, then defocuses on a second call', () => {
    const overlay = createNumericOverlay();
    overlay.focusField('distance');
    overlay.typeChar('7');
    expect(overlay.escape()).toEqual({ field: 'distance', distanceText: '', angleText: '' });
    expect(overlay.escape()).toEqual({ field: null, distanceText: '', angleText: '' });
  });

  it('escape on the focused field never touches the other field', () => {
    const overlay = createNumericOverlay();
    overlay.focusField('angle');
    overlay.typeChar('9');
    overlay.focusField('distance');
    overlay.typeChar('3');
    overlay.escape();
    expect(overlay.snapshot()).toEqual({ field: 'distance', distanceText: '', angleText: '9' });
  });

  it('reset clears everything', () => {
    const overlay = createNumericOverlay();
    overlay.focusField('distance');
    overlay.typeChar('5');
    expect(overlay.reset()).toEqual({ field: null, distanceText: '', angleText: '' });
  });
});

describe('parseNumericOverlay', () => {
  it('parses valid distance and angle text', () => {
    expect(parseNumericOverlay({ field: null, distanceText: '350', angleText: '45' })).toEqual({
      distance: 350,
      angleRadians: (45 * Math.PI) / 180,
    });
  });

  it('parses empty fields to null (use the fallback)', () => {
    expect(parseNumericOverlay({ field: null, distanceText: '', angleText: '' })).toEqual({
      distance: null,
      angleRadians: null,
    });
  });

  it('rejects a negative distance as null even if the text somehow contains one', () => {
    expect(
      parseNumericOverlay({ field: null, distanceText: '-5', angleText: '' }).distance,
    ).toBeNull();
  });

  it('allows a negative angle', () => {
    expect(
      parseNumericOverlay({ field: null, distanceText: '', angleText: '-90' }).angleRadians,
    ).toBeCloseTo(-Math.PI / 2, 10);
  });
});

describe('pointFromDistanceAndAngle', () => {
  it('computes a point straight along the positive x-axis for angle 0', () => {
    expect(pointFromDistanceAndAngle(worldPoint(0, 0), 10, 0).x).toBeCloseTo(10, 10);
  });

  it('computes a point straight up (world +y) for a 90 degree angle', () => {
    const point = pointFromDistanceAndAngle(worldPoint(0, 0), 10, Math.PI / 2);
    expect(point.x).toBeCloseTo(0, 10);
    expect(point.y).toBeCloseTo(10, 10);
  });
});

describe('resolveNumericOverlayPoint', () => {
  it('uses the typed distance but falls back to the cursor-derived angle when angle is untyped', () => {
    const parsed = { distance: 20, angleRadians: null };
    const point = resolveNumericOverlayPoint(parsed, worldPoint(0, 0), 5, 0);
    expect(point.x).toBeCloseTo(20, 10);
  });

  it('uses the typed angle but falls back to the cursor-derived distance when distance is untyped', () => {
    const parsed = { distance: null, angleRadians: Math.PI / 2 };
    const point = resolveNumericOverlayPoint(parsed, worldPoint(0, 0), 7, 0);
    expect(point.x).toBeCloseTo(0, 10);
    expect(point.y).toBeCloseTo(7, 10);
  });

  it('uses both fallbacks when nothing is typed', () => {
    const parsed = { distance: null, angleRadians: null };
    const point = resolveNumericOverlayPoint(parsed, worldPoint(1, 1), 3, Math.PI);
    expect(point.x).toBeCloseTo(1 - 3, 10);
    expect(point.y).toBeCloseTo(1, 10);
  });
});
