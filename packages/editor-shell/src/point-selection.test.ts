import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { pickAt } from './hit-test';
import { createPointHitTestable, createSingleSelection } from './point-selection';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

describe('createPointHitTestable', () => {
  it('hits within the tolerance radius around the target point', () => {
    const target = worldPoint(10, 10);
    const hitTestable = createPointHitTestable(target);
    expect(hitTestable.hitTest(worldPoint(10.5, 10), 1)).toBe(true);
    expect(hitTestable.hitTest(worldPoint(20, 20), 1)).toBe(false);
  });

  it('composes with pickAt to select the nearest-matching point candidate', () => {
    const candidates = [
      { id: 'p1', ...createPointHitTestable(worldPoint(0, 0)) },
      { id: 'p2', ...createPointHitTestable(worldPoint(5, 5)) },
    ];
    expect(pickAt(candidates, worldPoint(5.02, 5.02), viewport, 6)?.id).toBe('p2');
  });
});

describe('createSingleSelection', () => {
  it('starts with nothing selected', () => {
    expect(createSingleSelection<string>().snapshot()).toEqual({ selectedId: null });
  });

  it('select() replaces the current selection with a single id', () => {
    const selection = createSingleSelection<string>();
    selection.select('wall-1');
    expect(selection.snapshot()).toEqual({ selectedId: 'wall-1' });
    selection.select('wall-2');
    expect(selection.snapshot()).toEqual({ selectedId: 'wall-2' });
  });

  it('select(null) deselects, matching a click that hit nothing', () => {
    const selection = createSingleSelection<string>();
    selection.select('wall-1');
    selection.select(null);
    expect(selection.snapshot()).toEqual({ selectedId: null });
  });

  it('escape() always clears the selection', () => {
    const selection = createSingleSelection<string>();
    selection.select('wall-1');
    expect(selection.escape()).toEqual({ selectedId: null });
    expect(selection.escape()).toEqual({ selectedId: null });
  });
});
