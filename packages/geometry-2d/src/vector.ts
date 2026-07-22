/**
 * ARQ-082: implement point and vector primitives.
 *
 * A Vector2 (a direction/displacement) is kept structurally distinct
 * from WorldPoint/ScreenPoint (coordinate-system.ts, ARQ-032): a vector
 * has no "space" of its own (subtracting two WorldPoints or two
 * ScreenPoints both produce a plain Vector2), so it is deliberately not
 * branded to either space - vectorBetween/translatePoint are the two
 * bridge functions between "a position in a space" and "a direction",
 * and both stay branded on their WorldPoint/ScreenPoint side.
 *
 * normalizeVector's null return on a zero-length vector is the
 * "tolerance behaviour is explicit" requirement (ARQ-081) applied here:
 * there is no well-defined direction for a zero vector, and returning
 * null rather than {x: 0, y: 0} or a NaN-filled vector forces every
 * caller to decide what a degenerate direction means for them, rather
 * than silently propagating garbage - this is the "zero-length
 * segments" adversarial case from blueprint section 42.
 */

import { worldPoint, type ScreenPoint, type WorldPoint } from './coordinate-system';

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export function vector2(x: number, y: number): Vector2 {
  return { x, y };
}

export function addVectors(a: Vector2, b: Vector2): Vector2 {
  return vector2(a.x + b.x, a.y + b.y);
}

export function subtractVectors(a: Vector2, b: Vector2): Vector2 {
  return vector2(a.x - b.x, a.y - b.y);
}

export function scaleVector(v: Vector2, scalar: number): Vector2 {
  return vector2(v.x * scalar, v.y * scalar);
}

export function dotProduct(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}

/** The scalar z-component of the 3D cross product of two 2D vectors (extended with z=0) - positive when `b` is counter-clockwise from `a`. */
export function crossProduct(a: Vector2, b: Vector2): number {
  return a.x * b.y - a.y * b.x;
}

export function vectorLength(v: Vector2): number {
  return Math.hypot(v.x, v.y);
}

/** Returns a unit-length vector in the same direction, or null for a zero (or non-finite) vector, which has no well-defined direction. */
export function normalizeVector(v: Vector2): Vector2 | null {
  const length = vectorLength(v);
  if (!Number.isFinite(length) || length === 0) {
    return null;
  }
  return vector2(v.x / length, v.y / length);
}

export function vectorBetween(from: WorldPoint, to: WorldPoint): Vector2 {
  return vector2(to.x - from.x, to.y - from.y);
}

export function translatePoint(point: WorldPoint, v: Vector2): WorldPoint {
  return worldPoint(point.x + v.x, point.y + v.y);
}

export function screenVectorBetween(from: ScreenPoint, to: ScreenPoint): Vector2 {
  return vector2(to.x - from.x, to.y - from.y);
}
