import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { generateWallOpeningMeshes, type WallOpeningSpan } from './wall-opening-meshes';

const centerline = { start: worldPoint(0, 0), end: worldPoint(10, 0) };
const thickness = 0.2;
const wallHeight = 2.4;
const tolerance = 1e-6;

describe('generateWallOpeningMeshes', () => {
  it('produces exactly one mesh (the whole wall) when there are no openings', () => {
    const meshes = generateWallOpeningMeshes(
      centerline,
      thickness,
      'centre',
      wallHeight,
      0,
      [],
      tolerance,
    );
    expect(meshes).toHaveLength(1);
  });

  it('produces pier + header for a door (zero sillHeight) not touching either end', () => {
    const door: WallOpeningSpan = {
      offsetFromWallStart: 4,
      width: 0.9,
      sillHeight: 0,
      height: 2.1,
    };
    const meshes = generateWallOpeningMeshes(
      centerline,
      thickness,
      'centre',
      wallHeight,
      0,
      [door],
      tolerance,
    )!;
    // left pier, right pier, header above the door - no sill panel since sillHeight is 0.
    expect(meshes).toHaveLength(3);
  });

  it('produces pier + sill + header for a window (non-zero sillHeight, top below wall height)', () => {
    const window: WallOpeningSpan = {
      offsetFromWallStart: 4,
      width: 1.2,
      sillHeight: 0.9,
      height: 1.2,
    };
    const meshes = generateWallOpeningMeshes(
      centerline,
      thickness,
      'centre',
      wallHeight,
      0,
      [window],
      tolerance,
    )!;
    // left pier, right pier, sill, header = 4 panels.
    expect(meshes).toHaveLength(4);
  });

  it('omits the left pier when the opening touches the wall start', () => {
    const door: WallOpeningSpan = {
      offsetFromWallStart: 0,
      width: 0.9,
      sillHeight: 0,
      height: 2.1,
    };
    const meshes = generateWallOpeningMeshes(
      centerline,
      thickness,
      'centre',
      wallHeight,
      0,
      [door],
      tolerance,
    )!;
    // right pier + header only.
    expect(meshes).toHaveLength(2);
  });

  it('omits the right pier when the opening touches the wall end', () => {
    const door: WallOpeningSpan = {
      offsetFromWallStart: 9.1,
      width: 0.9,
      sillHeight: 0,
      height: 2.1,
    };
    const meshes = generateWallOpeningMeshes(
      centerline,
      thickness,
      'centre',
      wallHeight,
      0,
      [door],
      tolerance,
    )!;
    expect(meshes).toHaveLength(2);
  });

  it('adds a middle pier between two non-touching openings', () => {
    const doorA: WallOpeningSpan = {
      offsetFromWallStart: 1,
      width: 0.9,
      sillHeight: 0,
      height: 2.1,
    };
    const doorB: WallOpeningSpan = {
      offsetFromWallStart: 5,
      width: 0.9,
      sillHeight: 0,
      height: 2.1,
    };
    const meshes = generateWallOpeningMeshes(
      centerline,
      thickness,
      'centre',
      wallHeight,
      0,
      [doorA, doorB],
      tolerance,
    )!;
    // left pier, middle pier, right pier, header A, header B = 5 panels.
    expect(meshes).toHaveLength(5);
  });

  it('produces a well-formed Mesh3D for each panel', () => {
    const door: WallOpeningSpan = {
      offsetFromWallStart: 4,
      width: 0.9,
      sillHeight: 0,
      height: 2.1,
    };
    const meshes = generateWallOpeningMeshes(
      centerline,
      thickness,
      'centre',
      wallHeight,
      0,
      [door],
      tolerance,
    )!;
    for (const mesh of meshes) {
      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(mesh.indices.length % 3).toBe(0);
      expect(mesh.positions.length).toBe(mesh.normals.length);
    }
  });

  it('is order-independent for the input openings list (sorts internally)', () => {
    const doorA: WallOpeningSpan = {
      offsetFromWallStart: 1,
      width: 0.9,
      sillHeight: 0,
      height: 2.1,
    };
    const doorB: WallOpeningSpan = {
      offsetFromWallStart: 5,
      width: 0.9,
      sillHeight: 0,
      height: 2.1,
    };
    const forward = generateWallOpeningMeshes(
      centerline,
      thickness,
      'centre',
      wallHeight,
      0,
      [doorA, doorB],
      tolerance,
    )!;
    const reversed = generateWallOpeningMeshes(
      centerline,
      thickness,
      'centre',
      wallHeight,
      0,
      [doorB, doorA],
      tolerance,
    )!;
    expect(reversed).toHaveLength(forward.length);
  });

  it('returns null for a zero-length centerline (degenerate wall)', () => {
    const degenerate = { start: worldPoint(0, 0), end: worldPoint(0, 0) };
    expect(
      generateWallOpeningMeshes(degenerate, thickness, 'centre', wallHeight, 0, [], tolerance),
    ).toBeNull();
  });

  it('returns null for a non-positive wallHeight', () => {
    expect(
      generateWallOpeningMeshes(centerline, thickness, 'centre', 0, 0, [], tolerance),
    ).toBeNull();
    expect(
      generateWallOpeningMeshes(centerline, thickness, 'centre', -1, 0, [], tolerance),
    ).toBeNull();
  });

  it('returns null for a non-finite wallHeight (adversarial: non-finite values)', () => {
    expect(
      generateWallOpeningMeshes(centerline, thickness, 'centre', Number.NaN, 0, [], tolerance),
    ).toBeNull();
  });

  it('places panels at the given baseElevation', () => {
    const meshes = generateWallOpeningMeshes(
      centerline,
      thickness,
      'centre',
      wallHeight,
      3,
      [],
      tolerance,
    )!;
    const mesh = meshes[0]!;
    const yValues = new Set<number>();
    for (let i = 1; i < mesh.positions.length; i += 3) {
      yValues.add(mesh.positions[i]!);
    }
    expect(Math.min(...yValues)).toBeCloseTo(3, 9);
    expect(Math.max(...yValues)).toBeCloseTo(3 + wallHeight, 9);
  });
});
