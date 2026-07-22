import { describe, expect, it } from 'vitest';
import { worldPoint } from '@arq/geometry-2d';
import { extrudePolygonMesh } from './extrude-polygon-mesh';

const ccwUnitSquare = [worldPoint(0, 0), worldPoint(1, 0), worldPoint(1, 1), worldPoint(0, 1)];
const cwUnitSquare = [worldPoint(0, 0), worldPoint(0, 1), worldPoint(1, 1), worldPoint(1, 0)];

function normalAt(mesh: { normals: Float64Array }, triangleIndex: number) {
  const offset = triangleIndex * 9;
  return { x: mesh.normals[offset]!, y: mesh.normals[offset + 1]!, z: mesh.normals[offset + 2]! };
}

describe('extrudePolygonMesh', () => {
  it('produces the expected vertex/index counts for a 4-sided outline', () => {
    const mesh = extrudePolygonMesh(ccwUnitSquare, 0, 1)!;
    // 2 (bottom cap) + 2 (top cap) + 4 edges * 2 (side quads) = 12 triangles.
    expect(mesh.indices).toHaveLength(36);
    expect(mesh.positions).toHaveLength(12 * 3 * 3);
    expect(mesh.normals).toHaveLength(12 * 3 * 3);
  });

  it('the bottom cap faces downward (-Y) and the top cap faces upward (+Y)', () => {
    const mesh = extrudePolygonMesh(ccwUnitSquare, 0, 1)!;
    const bottomNormal = normalAt(mesh, 0);
    const topNormal = normalAt(mesh, 2);
    expect(bottomNormal.y).toBeCloseTo(-1, 9);
    expect(topNormal.y).toBeCloseTo(1, 9);
  });

  it('side faces have a horizontal (zero Y-component) outward normal', () => {
    const mesh = extrudePolygonMesh(ccwUnitSquare, 0, 1)!;
    // Side faces start after the 2 bottom + 2 top cap triangles.
    for (let i = 4; i < 12; i += 1) {
      const normal = normalAt(mesh, i);
      expect(normal.y).toBeCloseTo(0, 9);
    }
  });

  it('produces the same outward-facing normals regardless of the outline winding (CW input)', () => {
    const ccwMesh = extrudePolygonMesh(ccwUnitSquare, 0, 1)!;
    const cwMesh = extrudePolygonMesh(cwUnitSquare, 0, 1)!;
    expect(normalAt(cwMesh, 0).y).toBeCloseTo(normalAt(ccwMesh, 0).y, 9);
    expect(normalAt(cwMesh, 2).y).toBeCloseTo(normalAt(ccwMesh, 2).y, 9);
  });

  it('positions vertices between baseElevation and baseElevation + height', () => {
    const mesh = extrudePolygonMesh(ccwUnitSquare, 5, 3)!;
    const yValues = new Set<number>();
    for (let i = 1; i < mesh.positions.length; i += 3) {
      yValues.add(mesh.positions[i]!);
    }
    expect(Math.min(...yValues)).toBeCloseTo(5, 9);
    expect(Math.max(...yValues)).toBeCloseTo(8, 9);
  });

  it('maps a 2D outline point (x, y) to 3D (x, elevation-ish, y) - x/z match the plan, per model-scene.ts\'s coordinate convention', () => {
    const mesh = extrudePolygonMesh(ccwUnitSquare, 0, 1)!;
    const xValues = new Set<number>();
    const zValues = new Set<number>();
    for (let i = 0; i < mesh.positions.length; i += 3) {
      xValues.add(mesh.positions[i]!);
      zValues.add(mesh.positions[i + 2]!);
    }
    expect([...xValues].sort()).toEqual([0, 1]);
    expect([...zValues].sort()).toEqual([0, 1]);
  });

  it('returns null for fewer than 3 outline points (degenerate)', () => {
    expect(extrudePolygonMesh([worldPoint(0, 0), worldPoint(1, 1)], 0, 1)).toBeNull();
  });

  it('returns null for a non-positive height', () => {
    expect(extrudePolygonMesh(ccwUnitSquare, 0, 0)).toBeNull();
    expect(extrudePolygonMesh(ccwUnitSquare, 0, -1)).toBeNull();
  });

  it('returns null for a non-finite height or baseElevation (adversarial: non-finite values)', () => {
    expect(extrudePolygonMesh(ccwUnitSquare, 0, Number.NaN)).toBeNull();
    expect(extrudePolygonMesh(ccwUnitSquare, Number.POSITIVE_INFINITY, 1)).toBeNull();
  });

  it('returns null for a non-finite point in the outline (adversarial: non-finite values)', () => {
    const badOutline = [worldPoint(0, 0), worldPoint(Number.NaN, 1), worldPoint(1, 1)];
    expect(extrudePolygonMesh(badOutline, 0, 1)).toBeNull();
  });

  it('handles large world coordinates without losing precision (adversarial: large world coordinates)', () => {
    const offset = 1_000_000;
    const bigOutline = [
      worldPoint(offset, offset),
      worldPoint(offset + 1, offset),
      worldPoint(offset + 1, offset + 1),
      worldPoint(offset, offset + 1),
    ];
    const mesh = extrudePolygonMesh(bigOutline, offset, 3)!;
    expect(mesh).not.toBeNull();
    expect(mesh.indices).toHaveLength(36);
  });
});
