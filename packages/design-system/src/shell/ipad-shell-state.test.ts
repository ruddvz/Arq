import { describe, expect, it } from 'vitest';
import { toggleBottomSheetExpanded, toggleFullScreenCanvas } from './ipad-shell-state';

describe('toggleFullScreenCanvas', () => {
  it('flips the current state', () => {
    expect(toggleFullScreenCanvas(false)).toBe(true);
    expect(toggleFullScreenCanvas(true)).toBe(false);
  });
});

describe('toggleBottomSheetExpanded', () => {
  it('flips the current state', () => {
    expect(toggleBottomSheetExpanded(false)).toBe(true);
    expect(toggleBottomSheetExpanded(true)).toBe(false);
  });
});
