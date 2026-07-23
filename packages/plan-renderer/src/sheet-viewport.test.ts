import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { buildPlanViewport, projectPointToSheet, type SheetViewportTransform } from './sheet-viewport';
import type { PlanScene } from './plan-scene';

const identityTransform: SheetViewportTransform = { scale: 1, position: { x: 0, y: 0 } };

describe('projectPointToSheet', () => {
  it('is the identity when scale is 1 and position is the origin', () => {
    expect(projectPointToSheet(worldPoint(3, 4), identityTransform)).toEqual({ x: 3, y: 4 });
  });

  it('applies scale', () => {
    const transform: SheetViewportTransform = { scale: 0.01, position: { x: 0, y: 0 } };
    expect(projectPointToSheet(worldPoint(1000, 500), transform)).toEqual({ x: 10, y: 5 });
  });

  it('applies position as a translation after scaling', () => {
    const transform: SheetViewportTransform = { scale: 0.01, position: { x: 20, y: 30 } };
    expect(projectPointToSheet(worldPoint(1000, 500), transform)).toEqual({ x: 30, y: 35 });
  });
});

describe('buildPlanViewport', () => {
  const scene: PlanScene<string> = {
    primitives: [
      {
        kind: 'line',
        elementId: 'wall-1',
        points: [worldPoint(0, 0), worldPoint(1000, 0)],
        styleToken: 'default',
      },
      {
        kind: 'polygon',
        elementId: 'room-1',
        points: [worldPoint(0, 0), worldPoint(1000, 0), worldPoint(1000, 1000)],
        styleToken: 'selected-primary',
      },
      {
        kind: 'text',
        elementId: 'room-1',
        anchor: worldPoint(500, 500),
        text: 'Kitchen',
        styleToken: 'default',
      },
      {
        kind: 'handle',
        elementId: 'room-1',
        point: worldPoint(1000, 1000),
        styleToken: 'selected-primary',
      },
    ],
  };

  it('projects every primitive kind, preserving elementId, text and styleToken', () => {
    const transform: SheetViewportTransform = { scale: 0.01, position: { x: 20, y: 20 } };
    const result = buildPlanViewport(scene, transform);
    expect(result.primitives).toEqual([
      { kind: 'line', elementId: 'wall-1', points: [{ x: 20, y: 20 }, { x: 30, y: 20 }], styleToken: 'default' },
      {
        kind: 'polygon',
        elementId: 'room-1',
        points: [
          { x: 20, y: 20 },
          { x: 30, y: 20 },
          { x: 30, y: 30 },
        ],
        styleToken: 'selected-primary',
      },
      { kind: 'text', elementId: 'room-1', anchor: { x: 25, y: 25 }, text: 'Kitchen', styleToken: 'default' },
      { kind: 'handle', elementId: 'room-1', point: { x: 30, y: 30 }, styleToken: 'selected-primary' },
    ]);
  });

  it('preserves primitive order', () => {
    const result = buildPlanViewport(scene, identityTransform);
    expect(result.primitives.map((p) => p.kind)).toEqual(['line', 'polygon', 'text', 'handle']);
  });

  it('returns an empty scene for an empty input scene', () => {
    expect(buildPlanViewport({ primitives: [] }, identityTransform)).toEqual({ primitives: [] });
  });

  it('rejects a zero scale', () => {
    expect(() => buildPlanViewport(scene, { scale: 0, position: { x: 0, y: 0 } })).toThrow(/scale/);
  });

  it('rejects a negative scale', () => {
    expect(() => buildPlanViewport(scene, { scale: -1, position: { x: 0, y: 0 } })).toThrow(/scale/);
  });

  it('rejects a non-finite scale', () => {
    expect(() =>
      buildPlanViewport(scene, { scale: Number.POSITIVE_INFINITY, position: { x: 0, y: 0 } }),
    ).toThrow(/scale/);
  });
});
