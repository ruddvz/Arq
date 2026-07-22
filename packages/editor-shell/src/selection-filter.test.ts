import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { createPointHitTestable } from './point-selection';
import {
  categoryFilter,
  combineFilters,
  pickAtWithFilter,
  visibilityFilter,
} from './selection-filter';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

interface TestCandidate {
  readonly id: string;
  readonly category: 'a' | 'b';
  readonly visible: boolean;
  hitTest(point: ReturnType<typeof worldPoint>, tolerance: number): boolean;
}

function candidate(id: string, category: 'a' | 'b', visible: boolean): TestCandidate {
  return { id, category, visible, ...createPointHitTestable(worldPoint(0, 0)) };
}

describe('categoryFilter', () => {
  it('admits only candidates in the allowed set', () => {
    const filter = categoryFilter<TestCandidate>(['a']);
    expect(filter(candidate('1', 'a', true))).toBe(true);
    expect(filter(candidate('2', 'b', true))).toBe(false);
  });
});

describe('visibilityFilter', () => {
  it('admits only visible candidates', () => {
    const filter = visibilityFilter<TestCandidate>();
    expect(filter(candidate('1', 'a', true))).toBe(true);
    expect(filter(candidate('2', 'a', false))).toBe(false);
  });
});

describe('combineFilters', () => {
  it('requires every filter to pass (AND semantics)', () => {
    const filter = combineFilters<TestCandidate>(categoryFilter(['a']), visibilityFilter());
    expect(filter(candidate('1', 'a', true))).toBe(true);
    expect(filter(candidate('2', 'a', false))).toBe(false);
    expect(filter(candidate('3', 'b', true))).toBe(false);
  });
});

describe('pickAtWithFilter', () => {
  it('lets an eligible candidate win when a filtered-out candidate is stacked in front of it', () => {
    const candidates = [
      candidate('hidden-front', 'a', false),
      candidate('visible-back', 'a', true),
    ];
    const hit = pickAtWithFilter(candidates, worldPoint(0, 0), viewport, visibilityFilter());
    expect(hit?.id).toBe('visible-back');
  });

  it('returns undefined when the only hit is filtered out, rather than falling through to it', () => {
    const candidates = [candidate('hidden', 'a', false)];
    const hit = pickAtWithFilter(candidates, worldPoint(0, 0), viewport, visibilityFilter());
    expect(hit).toBeUndefined();
  });
});
