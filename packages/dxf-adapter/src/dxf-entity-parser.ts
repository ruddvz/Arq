/**
 * ARQ-158: exchange: prototype DXF parser.
 *
 * Reads a single entity's group-code buffer (everything between its
 * declaring `0 <TYPE>` group and the next `0` group) into a typed
 * DxfEntity. A recognized type whose required fields are missing (a
 * truncated or hand-edited file) returns null exactly like an
 * unrecognized type does - dxf-parser.ts folds both into the same
 * "not preserved" bucket of its support report, since either way this
 * prototype could not faithfully preserve the entity's content.
 */

import type { DxfGroup } from './dxf-tokenizer';
import type {
  DxfArcEntity,
  DxfCircleEntity,
  DxfEntity,
  DxfLineEntity,
  DxfPoint2,
  DxfPolylineEntity,
  DxfTextEntity,
} from './dxf-entities';

function findValue(buffer: readonly DxfGroup[], code: number): string | undefined {
  return buffer.find((group) => group.code === code)?.value;
}

function findNumber(buffer: readonly DxfGroup[], code: number): number | undefined {
  const value = findValue(buffer, code);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** DXF's own default layer name when an entity carries no explicit group-8 layer. */
function layerOf(buffer: readonly DxfGroup[]): string {
  return findValue(buffer, 8) ?? '0';
}

function parseLine(buffer: readonly DxfGroup[]): DxfLineEntity | null {
  const sx = findNumber(buffer, 10);
  const sy = findNumber(buffer, 20);
  const ex = findNumber(buffer, 11);
  const ey = findNumber(buffer, 21);
  if (sx === undefined || sy === undefined || ex === undefined || ey === undefined) {
    return null;
  }
  return { kind: 'LINE', layer: layerOf(buffer), start: { x: sx, y: sy }, end: { x: ex, y: ey } };
}

function parseCircle(buffer: readonly DxfGroup[]): DxfCircleEntity | null {
  const cx = findNumber(buffer, 10);
  const cy = findNumber(buffer, 20);
  const radius = findNumber(buffer, 40);
  if (cx === undefined || cy === undefined || radius === undefined) {
    return null;
  }
  return { kind: 'CIRCLE', layer: layerOf(buffer), center: { x: cx, y: cy }, radius };
}

function parseArc(buffer: readonly DxfGroup[]): DxfArcEntity | null {
  const cx = findNumber(buffer, 10);
  const cy = findNumber(buffer, 20);
  const radius = findNumber(buffer, 40);
  const startAngleDegrees = findNumber(buffer, 50);
  const endAngleDegrees = findNumber(buffer, 51);
  if (
    cx === undefined ||
    cy === undefined ||
    radius === undefined ||
    startAngleDegrees === undefined ||
    endAngleDegrees === undefined
  ) {
    return null;
  }
  return {
    kind: 'ARC',
    layer: layerOf(buffer),
    center: { x: cx, y: cy },
    radius,
    startAngleDegrees,
    endAngleDegrees,
  };
}

/** LWPOLYLINE vertices are an ordered run of (10=x, 20=y) group pairs; a 70 flag's bit 0 marks the polyline closed. */
function parseLwPolyline(buffer: readonly DxfGroup[]): DxfPolylineEntity | null {
  const vertices: DxfPoint2[] = [];
  let pendingX: number | undefined;
  let closed = false;
  for (const group of buffer) {
    if (group.code === 70) {
      const flags = Number.parseInt(group.value, 10);
      closed = Number.isFinite(flags) && (flags & 1) === 1;
      continue;
    }
    if (group.code === 10) {
      const x = Number.parseFloat(group.value);
      pendingX = Number.isFinite(x) ? x : undefined;
      continue;
    }
    if (group.code === 20 && pendingX !== undefined) {
      const y = Number.parseFloat(group.value);
      if (Number.isFinite(y)) {
        vertices.push({ x: pendingX, y });
      }
      pendingX = undefined;
    }
  }
  if (vertices.length === 0) {
    return null;
  }
  return { kind: 'LWPOLYLINE', layer: layerOf(buffer), closed, vertices };
}

function parseText(buffer: readonly DxfGroup[]): DxfTextEntity | null {
  const x = findNumber(buffer, 10);
  const y = findNumber(buffer, 20);
  const height = findNumber(buffer, 40);
  const text = findValue(buffer, 1);
  if (x === undefined || y === undefined || height === undefined || text === undefined) {
    return null;
  }
  return { kind: 'TEXT', layer: layerOf(buffer), insertion: { x, y }, height, text };
}

/** Dispatches by DXF entity type name; an unrecognized type or a recognized type missing required fields both return null. */
export function parseDxfEntity(type: string, buffer: readonly DxfGroup[]): DxfEntity | null {
  switch (type) {
    case 'LINE':
      return parseLine(buffer);
    case 'CIRCLE':
      return parseCircle(buffer);
    case 'ARC':
      return parseArc(buffer);
    case 'LWPOLYLINE':
      return parseLwPolyline(buffer);
    case 'TEXT':
      return parseText(buffer);
    default:
      return null;
  }
}
