import { describe, expect, it } from 'vitest';
import { isContextBarVisible } from './context-bar-state';

describe('isContextBarVisible', () => {
  it('is hidden with no active tool and no selection', () => {
    expect(isContextBarVisible(null, 0, 1)).toBe(false);
  });

  it('is visible with an active tool, even with no selection', () => {
    expect(isContextBarVisible('wall-draw', 0, 1)).toBe(true);
  });

  it('is visible with a selection, even with no active tool', () => {
    expect(isContextBarVisible(null, 2, 1)).toBe(true);
  });

  it('disappears once both the tool and selection are gone', () => {
    expect(isContextBarVisible('wall-draw', 1, 1)).toBe(true);
    expect(isContextBarVisible(null, 0, 1)).toBe(false);
  });

  it('is hidden when it has no actions to carry, whatever the tool says', () => {
    // An opened project arrives with Select active and nothing selected. That
    // satisfies the tool clause and there is still nothing to put in the bar,
    // which is how an empty strip ended up across the bottom of the drawing.
    expect(isContextBarVisible('select', 0, 0)).toBe(false);
    expect(isContextBarVisible('select', 3, 0)).toBe(false);
  });
});
