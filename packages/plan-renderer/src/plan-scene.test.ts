import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { buildPlanScene, resolveStyleToken, type PlanPrimitiveInput } from './plan-scene';

describe('resolveStyleToken', () => {
  const noneHidden = new Set<string>();
  const noneLocked = new Set<string>();
  const noSelection = { primary: null, secondary: new Set<string>() };

  it('returns null (omit) for a hidden element, even if also selected', () => {
    const hidden = new Set(['a']);
    const selection = { primary: 'a', secondary: new Set<string>() };
    expect(resolveStyleToken('a', hidden, selection, noneLocked)).toBeNull();
  });

  it('returns selected-primary for the primary selection', () => {
    const selection = { primary: 'a', secondary: new Set<string>() };
    expect(resolveStyleToken('a', noneHidden, selection, noneLocked)).toBe('selected-primary');
  });

  it('returns selected-secondary for a secondary selection member', () => {
    const selection = { primary: 'x', secondary: new Set(['a', 'b']) };
    expect(resolveStyleToken('a', noneHidden, selection, noneLocked)).toBe('selected-secondary');
  });

  it('returns locked for a locked, unselected element', () => {
    const locked = new Set(['a']);
    expect(resolveStyleToken('a', noneHidden, noSelection, locked)).toBe('locked');
  });

  it('prioritises selected-primary over locked', () => {
    const locked = new Set(['a']);
    const selection = { primary: 'a', secondary: new Set<string>() };
    expect(resolveStyleToken('a', noneHidden, selection, locked)).toBe('selected-primary');
  });

  it('returns default for an element with no special state', () => {
    expect(resolveStyleToken('a', noneHidden, noSelection, noneLocked)).toBe('default');
  });
});

describe('buildPlanScene', () => {
  const line: PlanPrimitiveInput<string> = {
    kind: 'line',
    elementId: 'wall-1',
    points: [worldPoint(0, 0), worldPoint(10, 0)],
  };
  const polygon: PlanPrimitiveInput<string> = {
    kind: 'polygon',
    elementId: 'room-1',
    points: [worldPoint(0, 0), worldPoint(10, 0), worldPoint(10, 10)],
  };
  const text: PlanPrimitiveInput<string> = {
    kind: 'text',
    elementId: 'room-1',
    anchor: worldPoint(5, 5),
    text: 'Living Room',
  };

  it('resolves each input to a styled primitive, preserving order', () => {
    const scene = buildPlanScene([line, polygon, text], new Set(), { primary: null, secondary: new Set() }, new Set());
    expect(scene.primitives).toHaveLength(3);
    expect(scene.primitives[0]).toEqual({ ...line, styleToken: 'default' });
    expect(scene.primitives[1]).toEqual({ ...polygon, styleToken: 'default' });
    expect(scene.primitives[2]).toEqual({ ...text, styleToken: 'default' });
  });

  it('omits a hidden element entirely rather than emitting a hidden-styled primitive', () => {
    const scene = buildPlanScene(
      [line, polygon],
      new Set(['wall-1']),
      { primary: null, secondary: new Set() },
      new Set(),
    );
    expect(scene.primitives).toHaveLength(1);
    expect(scene.primitives[0]?.elementId).toBe('room-1');
  });

  it('marks the primary-selected element and leaves others default', () => {
    const scene = buildPlanScene(
      [line, polygon],
      new Set(),
      { primary: 'room-1', secondary: new Set() },
      new Set(),
    );
    expect(scene.primitives.find((p) => p.elementId === 'wall-1')?.styleToken).toBe('default');
    expect(scene.primitives.find((p) => p.elementId === 'room-1')?.styleToken).toBe(
      'selected-primary',
    );
  });

  it('returns an empty scene when everything is hidden', () => {
    const scene = buildPlanScene(
      [line, polygon, text],
      new Set(['wall-1', 'room-1']),
      { primary: null, secondary: new Set() },
      new Set(),
    );
    expect(scene.primitives).toEqual([]);
  });
});
