import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import type { PlanScene } from './plan-scene';
import { DEFAULT_PLAN_PALETTE, paintPlanScene, type Canvas2dPaintTarget } from './canvas2d-paint';

type RecordedCall = readonly [method: string, ...args: unknown[]];

function createFakeTarget(): Canvas2dPaintTarget & { readonly calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const target: Canvas2dPaintTarget = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    font: '',
    beginPath: () => void calls.push(['beginPath']),
    moveTo: (x: number, y: number) => void calls.push(['moveTo', x, y]),
    lineTo: (x: number, y: number) => void calls.push(['lineTo', x, y]),
    closePath: () => void calls.push(['closePath']),
    stroke: () => void calls.push(['stroke']),
    fill: () => void calls.push(['fill']),
    fillText: (text: string, x: number, y: number) => void calls.push(['fillText', text, x, y]),
    arc: (x: number, y: number, radius: number, start: number, end: number) =>
      void calls.push(['arc', x, y, radius, start, end]),
    setLineDash: (segments: readonly number[]) => void calls.push(['setLineDash', segments]),
  } as Canvas2dPaintTarget;
  return Object.assign(target, { calls });
}

const identityViewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 100,
  screenHeight: 100,
};

describe('paintPlanScene', () => {
  it('throws for a non-positive devicePixelRatio', () => {
    const target = createFakeTarget();
    const scene: PlanScene<string> = { primitives: [] };
    expect(() => paintPlanScene(target, identityViewport, 0, scene)).toThrow(RangeError);
    expect(() => paintPlanScene(target, identityViewport, -1, scene)).toThrow(RangeError);
  });

  it('paints an open polyline for a line primitive, projected through the viewport', () => {
    const target = createFakeTarget();
    const scene: PlanScene<string> = {
      primitives: [
        {
          kind: 'line',
          elementId: 'a',
          points: [worldPoint(0, 0), worldPoint(10, 0)],
          styleToken: 'default',
        },
      ],
    };
    paintPlanScene(target, identityViewport, 1, scene);

    expect(target.calls).toContainEqual(['beginPath']);
    // world (0,0) -> screen centre (50, 50); world (10,0) -> (60, 50) (y-up world, y-down screen).
    expect(target.calls).toContainEqual(['moveTo', 50, 50]);
    expect(target.calls).toContainEqual(['lineTo', 60, 50]);
    expect(target.calls).toContainEqual(['stroke']);
    expect(target.calls).not.toContainEqual(['closePath']);
    expect(target.strokeStyle).toBe('#000000');
  });

  it('closes the path for a polygon primitive', () => {
    const target = createFakeTarget();
    const scene: PlanScene<string> = {
      primitives: [
        {
          kind: 'polygon',
          elementId: 'a',
          points: [worldPoint(0, 0), worldPoint(10, 0), worldPoint(10, 10)],
          styleToken: 'default',
        },
      ],
    };
    paintPlanScene(target, identityViewport, 1, scene);
    expect(target.calls).toContainEqual(['closePath']);
  });

  it('uses the phthalo-green brand accent for a selected-primary primitive, solid (no dash)', () => {
    const target = createFakeTarget();
    const scene: PlanScene<string> = {
      primitives: [
        {
          kind: 'line',
          elementId: 'a',
          points: [worldPoint(0, 0), worldPoint(10, 0)],
          styleToken: 'selected-primary',
        },
      ],
    };
    paintPlanScene(target, identityViewport, 1, scene);
    expect(target.strokeStyle).toBe('#0B6B50');
    expect(target.calls).toContainEqual(['setLineDash', []]);
  });

  it('dashes a selected-secondary primitive', () => {
    const target = createFakeTarget();
    const scene: PlanScene<string> = {
      primitives: [
        {
          kind: 'polygon',
          elementId: 'a',
          points: [worldPoint(0, 0), worldPoint(10, 0), worldPoint(10, 10)],
          styleToken: 'selected-secondary',
        },
      ],
    };
    paintPlanScene(target, identityViewport, 2, scene);
    expect(target.calls).toContainEqual(['setLineDash', [8, 8]]);
  });

  it('falls back to brand black for tokens with no assigned colour yet (documented gap)', () => {
    const target = createFakeTarget();
    const scene: PlanScene<string> = {
      primitives: [
        { kind: 'line', elementId: 'a', points: [worldPoint(0, 0)], styleToken: 'warning' },
      ],
    };
    paintPlanScene(target, identityViewport, 1, scene);
    expect(target.strokeStyle).toBe('#000000');
  });

  it('draws text primitives via fillText at the projected anchor', () => {
    const target = createFakeTarget();
    const scene: PlanScene<string> = {
      primitives: [
        {
          kind: 'text',
          elementId: 'a',
          anchor: worldPoint(0, 0),
          text: 'Room',
          styleToken: 'default',
        },
      ],
    };
    paintPlanScene(target, identityViewport, 1, scene);
    expect(target.calls).toContainEqual(['fillText', 'Room', 50, 50]);
  });

  it('draws handle primitives as a white-fill, black-border circle regardless of styleToken', () => {
    const target = createFakeTarget();
    const scene: PlanScene<string> = {
      primitives: [
        { kind: 'handle', elementId: 'a', point: worldPoint(0, 0), styleToken: 'selected-primary' },
      ],
    };
    paintPlanScene(target, identityViewport, 1, scene);
    expect(target.calls).toContainEqual(['arc', 50, 50, 4, 0, Math.PI * 2]);
    expect(target.fillStyle).toBe('#ffffff');
    expect(target.strokeStyle).toBe('#000000');
  });

  it('paints multiple primitives in scene order', () => {
    const target = createFakeTarget();
    const scene: PlanScene<string> = {
      primitives: [
        { kind: 'line', elementId: 'a', points: [worldPoint(0, 0)], styleToken: 'default' },
        {
          kind: 'text',
          elementId: 'b',
          anchor: worldPoint(0, 0),
          text: 'x',
          styleToken: 'default',
        },
      ],
    };
    paintPlanScene(target, identityViewport, 1, scene);
    const fillTextIndex = target.calls.findIndex((call) => call[0] === 'fillText');
    const firstBeginPathIndex = target.calls.findIndex((call) => call[0] === 'beginPath');
    expect(firstBeginPathIndex).toBeLessThan(fillTextIndex);
  });
});

describe('polygon fills', () => {
  function recordingTarget() {
    const calls: string[] = [];
    const target = {
      beginPath: () => calls.push('beginPath'),
      closePath: () => calls.push('closePath'),
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      arc: () => calls.push('arc'),
      stroke: () => calls.push('stroke'),
      fill: () => calls.push('fill'),
      fillText: () => calls.push('fillText'),
      setLineDash: () => calls.push('setLineDash'),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 0,
      font: '',
    } as unknown as Canvas2dPaintTarget & { fillStyle: string };
    return { target, calls };
  }

  const VIEWPORT = {
    center: worldPoint(0, 0),
    pixelsPerUnit: 1,
    screenWidth: 100,
    screenHeight: 100,
  };
  const SQUARE = [worldPoint(0, 0), worldPoint(10, 0), worldPoint(10, 10), worldPoint(0, 10)];

  it('leaves a polygon without a fill exactly as it was: outline only', () => {
    const { target, calls } = recordingTarget();
    paintPlanScene(
      target,
      VIEWPORT,
      1,
      { primitives: [{ kind: 'polygon', elementId: 'w', points: SQUARE, styleToken: 'default' }] },
      DEFAULT_PLAN_PALETTE,
    );
    expect(calls).not.toContain('fill');
    expect(calls).toContain('stroke');
  });

  it('fills before it strokes, so the outline is not half-covered by its own fill', () => {
    const { target, calls } = recordingTarget();
    paintPlanScene(
      target,
      VIEWPORT,
      1,
      {
        primitives: [
          { kind: 'polygon', elementId: 'w', points: SQUARE, styleToken: 'default', fill: 'poche' },
        ],
      },
      { ...DEFAULT_PLAN_PALETTE, poche: '#123456' },
    );
    expect(calls.indexOf('fill')).toBeLessThan(calls.lastIndexOf('stroke'));
  });

  it('skips a fill the palette has no colour for, rather than defaulting one', () => {
    const { target, calls } = recordingTarget();
    paintPlanScene(
      target,
      VIEWPORT,
      1,
      {
        primitives: [
          { kind: 'polygon', elementId: 'r', points: SQUARE, styleToken: 'default', fill: 'room' },
        ],
      },
      // An unasked-for colour on a drawing is worse than no colour at all.
      DEFAULT_PLAN_PALETTE,
    );
    expect(calls).not.toContain('fill');
  });

  it('does not fill a degenerate polygon that cannot enclose anything', () => {
    const { target, calls } = recordingTarget();
    paintPlanScene(
      target,
      VIEWPORT,
      1,
      {
        primitives: [
          {
            kind: 'polygon',
            elementId: 'w',
            points: [worldPoint(0, 0), worldPoint(10, 0)],
            styleToken: 'default',
            fill: 'poche',
          },
        ],
      },
      { ...DEFAULT_PLAN_PALETTE, poche: '#123456' },
    );
    expect(calls).not.toContain('fill');
  });
});
