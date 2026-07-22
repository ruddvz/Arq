import { describe, expect, it } from 'vitest';
import { worldPoint, type Viewport } from '@arq/geometry-2d';
import { createWindowPlacementTool, type WindowHostCandidate } from './window-placement-tool';

const viewport: Viewport = {
  center: worldPoint(0, 0),
  pixelsPerUnit: 1,
  screenWidth: 800,
  screenHeight: 600,
};

const wallA: WindowHostCandidate<string> = {
  id: 'wall-a',
  start: worldPoint(0, 0),
  end: worldPoint(10, 0),
};

const wallB: WindowHostCandidate<string> = {
  id: 'wall-b',
  start: worldPoint(0, 5),
  end: worldPoint(10, 5),
};

describe('createWindowPlacementTool: happy path', () => {
  it('walks arm -> preview -> hover -> placeOnHost -> finish, producing a placement', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    const preview = tool.hover([wallA], worldPoint(4, 0.2), viewport)!;
    expect(preview.hostId).toBe('wall-a');
    expect(preview.offsetFromWallStart).toBeCloseTo(4, 9);

    tool.placeOnHost(wallA, preview.offsetFromWallStart);
    const placement = tool.finish()!;
    expect(placement).toEqual({ hostId: 'wall-a', offsetFromWallStart: 4, side: 'right' });
    expect(tool.snapshot().lifecycle.state).toBe('committed');
  });

  it('hover returns null when nothing is within tolerance', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    expect(tool.hover([wallA], worldPoint(4, 50), viewport)).toBeNull();
  });

  it('hover picks the nearest of several host candidates', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    const preview = tool.hover([wallA, wallB], worldPoint(4, 4.9), viewport, 200)!;
    expect(preview.hostId).toBe('wall-b');
  });

  it('finishing before any host is placed commits nothing (invalid input leaves nothing to act on)', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    expect(tool.finish()).toBeNull();
  });

  it('finishing with an offset beyond the host length commits nothing', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeOnHost(wallA, 15);
    expect(tool.finish()).toBeNull();
    expect(tool.snapshot().lifecycle.state).toBe('failed-safely');
  });

  it('finishing with a negative offset commits nothing', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeOnHost(wallA, -1);
    expect(tool.finish()).toBeNull();
  });

  it('an offset exactly at the host end is valid (touching wall end, blueprint section 42)', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeOnHost(wallA, 10);
    expect(tool.finish()).toEqual({ hostId: 'wall-a', offsetFromWallStart: 10, side: 'right' });
  });
});

describe('createWindowPlacementTool: numeric overlay integration', () => {
  it('placeOnHost uses the raw hover-derived offset when no overlay field is typed', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeOnHost(wallA, 3);
    expect(tool.snapshot().offsetFromWallStart).toBe(3);
  });

  it('placeOnHost uses a typed distance override in place of the raw offset', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.overlay.focusField('distance');
    tool.overlay.typeChar('6');
    tool.placeOnHost(wallA, 3);
    expect(tool.snapshot().offsetFromWallStart).toBe(6);
  });

  it('placeOnHost resets the overlay so the next placement starts with no stale typed value', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.overlay.focusField('distance');
    tool.overlay.typeChar('6');
    tool.placeOnHost(wallA, 3);
    expect(tool.snapshot().overlay).toEqual({ field: null, distanceText: '', angleText: '' });
  });
});

describe('createWindowPlacementTool: flip side', () => {
  it('flipSide toggles from the right default and carries into the finished placement', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeOnHost(wallA, 3);
    tool.flipSide();
    expect(tool.finish()).toEqual({ hostId: 'wall-a', offsetFromWallStart: 3, side: 'left' });
  });

  it('arming again resets side to the right default', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeOnHost(wallA, 3);
    tool.flipSide();
    tool.arm();
    expect(tool.snapshot().side).toBe('right');
  });
});

describe('createWindowPlacementTool: escape tiers', () => {
  it('tier 1: clears a pending overlay field without cancelling the already-chosen host', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeOnHost(wallA, 3);
    tool.beginPreview();
    tool.overlay.focusField('distance');
    tool.overlay.typeChar('5');
    const afterEscape = tool.escape();
    expect(afterEscape.overlay.distanceText).toBe('');
    expect(afterEscape.hostId).toBe('wall-a');
    expect(afterEscape.offsetFromWallStart).toBe(3);
  });

  it('tier 2: with no pending field text, clears the chosen host and offset', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeOnHost(wallA, 3);
    const afterEscape = tool.escape();
    expect(afterEscape.hostId).toBeNull();
    expect(afterEscape.offsetFromWallStart).toBeNull();
  });

  it('tier 3: with no field text and no host chosen, exits the tool', () => {
    const tool = createWindowPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeOnHost(wallA, 3);
    tool.escape(); // clears the chosen host -> back to armed
    const afterSecondEscape = tool.escape();
    expect(afterSecondEscape.lifecycle.state).toBe('cancelled');
  });
});
