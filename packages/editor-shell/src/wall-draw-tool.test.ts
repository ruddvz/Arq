import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { createWallDrawTool } from './wall-draw-tool';

describe('createWallDrawTool: happy path', () => {
  it('walks arm -> preview -> place -> preview -> place -> finish, producing one segment per consecutive pair', () => {
    const tool = createWallDrawTool();
    tool.arm();
    tool.beginPreview();
    tool.placePoint(worldPoint(0, 0));
    tool.beginPreview();
    tool.placePoint(worldPoint(10, 0));
    tool.beginPreview();
    tool.placePoint(worldPoint(10, 10));
    const segments = tool.finish();
    expect(segments).toEqual([
      { start: worldPoint(0, 0), end: worldPoint(10, 0) },
      { start: worldPoint(10, 0), end: worldPoint(10, 10) },
    ]);
    expect(tool.snapshot().lifecycle.state).toBe('committed');
  });

  it('finishing with only one point placed commits nothing (invalid input leaves nothing to act on)', () => {
    const tool = createWallDrawTool();
    tool.arm();
    tool.beginPreview();
    tool.placePoint(worldPoint(0, 0));
    const segments = tool.finish();
    expect(segments).toEqual([]);
    expect(tool.snapshot().lifecycle.state).toBe('failed-safely');
  });

  it('finishing immediately after arm (no points placed) commits nothing', () => {
    const tool = createWallDrawTool();
    tool.arm();
    expect(tool.finish()).toEqual([]);
  });
});

describe('createWallDrawTool: numeric overlay integration', () => {
  it('previewPoint uses the raw cursor fallback when no overlay field is typed', () => {
    const tool = createWallDrawTool();
    tool.arm();
    tool.beginPreview();
    tool.placePoint(worldPoint(0, 0));
    tool.beginPreview();
    const preview = tool.previewPoint(10, 0);
    expect(preview?.x).toBeCloseTo(10, 9);
    expect(preview?.y).toBeCloseTo(0, 9);
  });

  it('previewPoint uses a typed distance override, still following the live cursor angle', () => {
    const tool = createWallDrawTool();
    tool.arm();
    tool.beginPreview();
    tool.placePoint(worldPoint(0, 0));
    tool.beginPreview();
    tool.overlay.focusField('distance');
    tool.overlay.typeChar('5');
    const preview = tool.previewPoint(10, 0);
    expect(preview?.x).toBeCloseTo(5, 9);
    expect(preview?.y).toBeCloseTo(0, 9);
  });

  it('previewPoint returns null before any point has been placed', () => {
    const tool = createWallDrawTool();
    tool.arm();
    tool.beginPreview();
    expect(tool.previewPoint(10, 0)).toBeNull();
  });

  it('placing a point resets the overlay so the next segment starts with no stale typed value', () => {
    const tool = createWallDrawTool();
    tool.arm();
    tool.beginPreview();
    tool.overlay.focusField('distance');
    tool.overlay.typeChar('7');
    tool.placePoint(worldPoint(0, 0));
    expect(tool.snapshot().overlay).toEqual({ field: null, distanceText: '', angleText: '' });
  });
});

describe('createWallDrawTool: escape tiers', () => {
  it('tier 1: clears a pending overlay field without cancelling the just-placed point', () => {
    const tool = createWallDrawTool();
    tool.arm();
    tool.beginPreview();
    tool.placePoint(worldPoint(0, 0));
    tool.beginPreview();
    tool.overlay.focusField('distance');
    tool.overlay.typeChar('5');
    const afterEscape = tool.escape();
    expect(afterEscape.overlay.distanceText).toBe('');
    expect(afterEscape.points).toEqual([worldPoint(0, 0)]);
    expect(afterEscape.lifecycle.state).toBe('previewing');
  });

  it('tier 2: with no pending field text, cancels the most recently placed point', () => {
    const tool = createWallDrawTool();
    tool.arm();
    tool.beginPreview();
    tool.placePoint(worldPoint(0, 0));
    tool.beginPreview();
    tool.placePoint(worldPoint(10, 0));
    expect(tool.snapshot().points).toEqual([worldPoint(0, 0), worldPoint(10, 0)]);
    const afterEscape = tool.escape();
    expect(afterEscape.points).toEqual([worldPoint(0, 0)]);
  });

  it('tier 3: with no field text and no segments left, exits the tool', () => {
    const tool = createWallDrawTool();
    tool.arm();
    tool.beginPreview();
    tool.placePoint(worldPoint(0, 0));
    tool.escape(); // cancels the one placed point -> back to armed, 0 points
    expect(tool.snapshot().points).toEqual([]);
    const afterSecondEscape = tool.escape();
    expect(afterSecondEscape.lifecycle.state).toBe('cancelled');
  });
});
