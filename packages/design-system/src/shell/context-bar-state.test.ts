import { describe, expect, it } from 'vitest';
import { isContextBarVisible } from './context-bar-state';

describe('isContextBarVisible', () => {
  it('is hidden with no active tool and no selection', () => {
    expect(isContextBarVisible(null, 0)).toBe(false);
  });

  it('is visible with an active tool, even with no selection', () => {
    expect(isContextBarVisible('wall-draw', 0)).toBe(true);
  });

  it('is visible with a selection, even with no active tool', () => {
    expect(isContextBarVisible(null, 2)).toBe(true);
  });

  it('disappears once both the tool and selection are gone', () => {
    expect(isContextBarVisible('wall-draw', 1)).toBe(true);
    expect(isContextBarVisible(null, 0)).toBe(false);
  });
});
