import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { pickAllAt } from './hit-test';
import { createPointHitTestable } from './point-selection';
import { createCandidateCycler } from './candidate-cycling';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

describe('pickAllAt', () => {
  it('returns every matching candidate id, not just the first', () => {
    const candidates = [
      { id: 'back', ...createPointHitTestable(worldPoint(0, 0)) },
      { id: 'middle', ...createPointHitTestable(worldPoint(0, 0)) },
      { id: 'front', ...createPointHitTestable(worldPoint(0, 0)) },
      { id: 'elsewhere', ...createPointHitTestable(worldPoint(500, 500)) },
    ];
    expect(pickAllAt(candidates, worldPoint(0, 0), viewport)).toEqual(['back', 'middle', 'front']);
  });
});

describe('createCandidateCycler', () => {
  it('begin() returns the first (top-priority) candidate', () => {
    const cycler = createCandidateCycler<string>();
    expect(cycler.begin(['a', 'b', 'c'])).toBe('a');
    expect(cycler.current()).toBe('a');
  });

  it('begin() with no candidates returns null', () => {
    const cycler = createCandidateCycler<string>();
    expect(cycler.begin([])).toBeNull();
  });

  it('cycleNext() advances through the stack and wraps around after the last', () => {
    const cycler = createCandidateCycler<string>();
    cycler.begin(['a', 'b', 'c']);
    expect(cycler.cycleNext()).toBe('b');
    expect(cycler.cycleNext()).toBe('c');
    expect(cycler.cycleNext()).toBe('a');
  });

  it('a fresh begin() resets the cycle back to the top candidate', () => {
    const cycler = createCandidateCycler<string>();
    cycler.begin(['a', 'b', 'c']);
    cycler.cycleNext();
    cycler.cycleNext();
    expect(cycler.current()).toBe('c');
    expect(cycler.begin(['x', 'y'])).toBe('x');
  });

  it('cycleNext() on an empty stack returns null and does not throw', () => {
    const cycler = createCandidateCycler<string>();
    expect(cycler.cycleNext()).toBeNull();
  });

  it('reset() clears the stack so current() and cycleNext() both return null', () => {
    const cycler = createCandidateCycler<string>();
    cycler.begin(['a', 'b']);
    cycler.reset();
    expect(cycler.current()).toBeNull();
    expect(cycler.cycleNext()).toBeNull();
  });
});
