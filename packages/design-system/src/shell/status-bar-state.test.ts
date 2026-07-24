import { describe, expect, it } from 'vitest';
import {
  formatActiveSnap,
  formatCoordinates,
  formatModelHealth,
  formatPerformanceWarning,
  formatSelectionCount,
  formatViewScale,
} from './status-bar-state';

describe('formatCoordinates', () => {
  it('formats an x/y pair with the given unit label', () => {
    expect(formatCoordinates({ x: 100, y: 250 }, 'mm')).toBe('100mm, 250mm');
  });

  it('respects fractionDigits', () => {
    expect(formatCoordinates({ x: 100.456, y: 0 }, 'mm', 2)).toBe('100.46mm, 0.00mm');
  });

  it('shows an em dash when the pointer is outside the canvas, never a fake (0, 0)', () => {
    expect(formatCoordinates(null, 'mm')).toBe('—');
  });
});

describe('formatActiveSnap', () => {
  it('passes through a real snap label', () => {
    expect(formatActiveSnap('Endpoint')).toBe('Endpoint');
  });

  it('shows a written "no snap" state, not a blank string', () => {
    expect(formatActiveSnap(null)).toBe('No snap');
  });
});

describe('formatSelectionCount', () => {
  it('shows "No selection" for zero', () => {
    expect(formatSelectionCount(0)).toBe('No selection');
  });

  it('is singular for exactly one', () => {
    expect(formatSelectionCount(1)).toBe('1 selected');
  });

  it('is plural for more than one', () => {
    expect(formatSelectionCount(3)).toBe('3 selected');
  });

  it('rejects a negative or non-integer count', () => {
    expect(() => formatSelectionCount(-1)).toThrow(RangeError);
    expect(() => formatSelectionCount(1.5)).toThrow(RangeError);
  });
});

describe('formatViewScale', () => {
  it('formats pixelsPerUnit as a rounded percentage', () => {
    expect(formatViewScale(1)).toBe('100%');
    expect(formatViewScale(0.5)).toBe('50%');
    expect(formatViewScale(2)).toBe('200%');
  });

  it('rejects a non-positive or non-finite scale', () => {
    expect(() => formatViewScale(0)).toThrow(RangeError);
    expect(() => formatViewScale(-1)).toThrow(RangeError);
    expect(() => formatViewScale(Number.NaN)).toThrow(RangeError);
  });
});

describe('formatModelHealth', () => {
  it('reports no issues when both counts are zero', () => {
    expect(formatModelHealth({ errorCount: 0, warningCount: 0 })).toBe('No issues');
  });

  it('reports errors and warnings together, errors first', () => {
    expect(formatModelHealth({ errorCount: 2, warningCount: 1 })).toBe('2 errors, 1 warning');
  });

  it('reports only warnings when there are no errors', () => {
    expect(formatModelHealth({ errorCount: 0, warningCount: 5 })).toBe('5 warnings');
  });
});

describe('formatPerformanceWarning', () => {
  it('is null when support mode is off', () => {
    expect(formatPerformanceWarning(false)).toBeNull();
  });

  it('names the mode when enabled', () => {
    expect(formatPerformanceWarning(true)).toBe('Support mode: performance may be reduced');
  });
});
