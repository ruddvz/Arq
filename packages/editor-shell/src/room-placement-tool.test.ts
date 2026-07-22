import { describe, expect, it } from 'vitest';
import { worldPoint, type RoomBoundaryEdge } from '@arq/geometry-2d';
import { createRoomPlacementTool } from './room-placement-tool';

function edge(id: string, sx: number, sy: number, ex: number, ey: number): RoomBoundaryEdge<string> {
  return { id, start: worldPoint(sx, sy), end: worldPoint(ex, ey) };
}

const square = [
  edge('n', 0, 0, 10, 0),
  edge('e', 10, 0, 10, 10),
  edge('s', 10, 10, 0, 10),
  edge('w', 0, 10, 0, 0),
];

describe('createRoomPlacementTool: happy path', () => {
  it('walks arm -> preview -> hover -> placeSeed -> setName -> finish, producing a placement', () => {
    const tool = createRoomPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    const preview = tool.hover(square, worldPoint(5, 5), 1e-6);
    expect(preview.status).toBe('valid');
    expect(preview.area).toBeCloseTo(100, 6);

    tool.placeSeed(square, worldPoint(5, 5), 1e-6);
    tool.setName('Living Room');
    const placement = tool.finish()!;
    expect(placement.seedPoint).toEqual(worldPoint(5, 5));
    expect(placement.name).toBe('Living Room');
    expect(placement.area).toBeCloseTo(100, 6);
    expect(new Set(placement.boundaryEdgeIds)).toEqual(new Set(['n', 'e', 's', 'w']));
    expect(tool.snapshot().lifecycle.state).toBe('committed');
  });

  it('hover reports not-enclosed for a point outside any boundary', () => {
    const tool = createRoomPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    const preview = tool.hover(square, worldPoint(50, 50), 1e-6);
    expect(preview.status).toBe('not-enclosed');
    expect(preview.area).toBe(0);
  });

  it('finishing before a seed is placed commits nothing (invalid input leaves nothing to act on)', () => {
    const tool = createRoomPlacementTool<string>();
    tool.arm();
    expect(tool.finish()).toBeNull();
  });

  it('finishing without a name commits nothing', () => {
    const tool = createRoomPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeSeed(square, worldPoint(5, 5), 1e-6);
    expect(tool.finish()).toBeNull();
    expect(tool.snapshot().lifecycle.state).toBe('failed-safely');
  });

  it('finishing with only whitespace as the name commits nothing', () => {
    const tool = createRoomPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeSeed(square, worldPoint(5, 5), 1e-6);
    tool.setName('   ');
    expect(tool.finish()).toBeNull();
  });

  it('finishing at a seed point outside any boundary commits nothing even with a name assigned', () => {
    const tool = createRoomPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeSeed(square, worldPoint(50, 50), 1e-6);
    tool.setName('Nowhere');
    expect(tool.finish()).toBeNull();
  });
});

describe('createRoomPlacementTool: escape tiers', () => {
  it('tier 1: clears the typed name without cancelling the placed seed', () => {
    const tool = createRoomPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeSeed(square, worldPoint(5, 5), 1e-6);
    tool.setName('Living Room');
    const afterEscape = tool.escape();
    expect(afterEscape.name).toBe('');
    expect(afterEscape.seedPoint).toEqual(worldPoint(5, 5));
  });

  it('tier 2: with no typed name, clears the placed seed and boundary', () => {
    const tool = createRoomPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeSeed(square, worldPoint(5, 5), 1e-6);
    const afterEscape = tool.escape();
    expect(afterEscape.seedPoint).toBeNull();
    expect(afterEscape.preview).toBeNull();
  });

  it('tier 3: with no name and no seed placed, exits the tool', () => {
    const tool = createRoomPlacementTool<string>();
    tool.arm();
    tool.beginPreview();
    tool.placeSeed(square, worldPoint(5, 5), 1e-6);
    tool.escape(); // clears the placed seed -> back to armed
    const afterSecondEscape = tool.escape();
    expect(afterSecondEscape.lifecycle.state).toBe('cancelled');
  });
});
