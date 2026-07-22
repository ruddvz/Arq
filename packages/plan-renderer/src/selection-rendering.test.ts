import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import type { PlanScene } from './plan-scene';
import { withSelectionHandles } from './selection-rendering';

describe('withSelectionHandles', () => {
  it('adds one handle per vertex for a selected-primary line', () => {
    const scene: PlanScene<string> = {
      primitives: [
        {
          kind: 'line',
          elementId: 'wall-1',
          points: [worldPoint(0, 0), worldPoint(10, 0)],
          styleToken: 'selected-primary',
        },
      ],
    };
    const result = withSelectionHandles(scene);
    const handles = result.primitives.filter((p) => p.kind === 'handle');
    expect(handles).toHaveLength(2);
    expect(handles.map((h) => h.point)).toEqual([worldPoint(0, 0), worldPoint(10, 0)]);
    expect(handles.every((h) => h.elementId === 'wall-1')).toBe(true);
    expect(handles.every((h) => h.styleToken === 'selected-primary')).toBe(true);
  });

  it('adds one handle per vertex for a selected-primary polygon', () => {
    const scene: PlanScene<string> = {
      primitives: [
        {
          kind: 'polygon',
          elementId: 'room-1',
          points: [worldPoint(0, 0), worldPoint(10, 0), worldPoint(10, 10)],
          styleToken: 'selected-primary',
        },
      ],
    };
    const result = withSelectionHandles(scene);
    expect(result.primitives.filter((p) => p.kind === 'handle')).toHaveLength(3);
  });

  it('does not add handles for a selected-secondary primitive', () => {
    const scene: PlanScene<string> = {
      primitives: [
        {
          kind: 'line',
          elementId: 'wall-1',
          points: [worldPoint(0, 0), worldPoint(10, 0)],
          styleToken: 'selected-secondary',
        },
      ],
    };
    const result = withSelectionHandles(scene);
    expect(result).toBe(scene);
  });

  it('does not add handles for a default (unselected) primitive', () => {
    const scene: PlanScene<string> = {
      primitives: [
        {
          kind: 'polygon',
          elementId: 'room-1',
          points: [worldPoint(0, 0), worldPoint(10, 0), worldPoint(10, 10)],
          styleToken: 'default',
        },
      ],
    };
    expect(withSelectionHandles(scene)).toBe(scene);
  });

  it('does not add a handle for a selected-primary text primitive (no vertices to handle)', () => {
    const scene: PlanScene<string> = {
      primitives: [
        {
          kind: 'text',
          elementId: 'note-1',
          anchor: worldPoint(5, 5),
          text: 'Living Room',
          styleToken: 'selected-primary',
        },
      ],
    };
    expect(withSelectionHandles(scene)).toBe(scene);
  });

  it('preserves the original primitives and appends handles after them', () => {
    const scene: PlanScene<string> = {
      primitives: [
        {
          kind: 'line',
          elementId: 'wall-1',
          points: [worldPoint(0, 0), worldPoint(10, 0)],
          styleToken: 'selected-primary',
        },
        {
          kind: 'polygon',
          elementId: 'room-1',
          points: [worldPoint(0, 0), worldPoint(10, 0), worldPoint(10, 10)],
          styleToken: 'default',
        },
      ],
    };
    const result = withSelectionHandles(scene);
    expect(result.primitives[0]).toEqual(scene.primitives[0]);
    expect(result.primitives[1]).toEqual(scene.primitives[1]);
    expect(result.primitives[2]?.kind).toBe('handle');
    expect(result.primitives[3]?.kind).toBe('handle');
  });

  it('handles a scene with multiple selected-primary primitives (only one should really occur in practice, but must not crash)', () => {
    const scene: PlanScene<string> = {
      primitives: [
        { kind: 'line', elementId: 'a', points: [worldPoint(0, 0)], styleToken: 'selected-primary' },
        { kind: 'line', elementId: 'b', points: [worldPoint(1, 1)], styleToken: 'selected-primary' },
      ],
    };
    const result = withSelectionHandles(scene);
    expect(result.primitives.filter((p) => p.kind === 'handle')).toHaveLength(2);
  });
});
