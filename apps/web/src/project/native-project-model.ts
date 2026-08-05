/**
 * The boundary between an `.arq` archive's `model.json` - arbitrary parsed JSON,
 * typed `unknown` by @arq/project-format on purpose - and the typed, branded
 * document `apps/web` actually edits.
 *
 * Everything crossing this boundary is untrusted. `importArchive` guarantees the
 * bytes parsed as JSON and stayed inside the complexity limits; it deliberately
 * says nothing about the *shape*, because the archive format does not own the
 * web app's model. So this module validates rather than casts: a wall whose
 * coordinates are strings, `NaN`, or missing is a rejected decode, not a wall
 * that renders at `(NaN, NaN)` and quietly corrupts every later save.
 *
 * Coordinates are reconstructed through `worldPoint`, the canonical branded
 * constructor, rather than passed through as plain numbers. The brand is what
 * stops a screen coordinate being used where a world coordinate belongs
 * (`@arq/geometry-2d`'s coordinate-system.ts); a decoder that hands back plain
 * numbers widened to `WorldPoint` by assertion would put unbranded values into
 * the one place the rest of the app is entitled to assume they are branded.
 */
import { worldPoint, type WorldPoint } from '@arq/geometry-2d';
import type { DrawnWall } from '../canvas/plan-document';

/** The `model.json` payload this build writes. Kept explicit so a change to it is a visible format change. */
export interface NativeProjectModel {
  readonly projectName: string;
  readonly walls: readonly DrawnWall[];
}

export type NativeProjectModelDecodeResult =
  | { readonly status: 'decoded'; readonly model: NativeProjectModel }
  | { readonly status: 'rejected'; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A coordinate has to be a real, finite number. `NaN` and `Infinity` survive
 * `JSON.parse` only as `null` or as a string, but a hand-edited or
 * foreign-written model can carry either, and both would poison geometry
 * silently rather than loudly.
 */
function decodePoint(value: unknown): WorldPoint | null {
  if (!isRecord(value)) return null;
  const { x, y } = value;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return worldPoint(x, y);
}

function decodeWall(value: unknown, index: number): DrawnWall | string {
  if (!isRecord(value)) return `wall ${index} is not an object`;
  const { id, start, end } = value;
  if (typeof id !== 'string' || id.length === 0) return `wall ${index} has no usable id`;
  const decodedStart = decodePoint(start);
  if (decodedStart === null) return `wall ${index} has an invalid start point`;
  const decodedEnd = decodePoint(end);
  if (decodedEnd === null) return `wall ${index} has an invalid end point`;
  return { id, start: decodedStart, end: decodedEnd };
}

/**
 * Decodes `model.json` into the editable document, or explains why it could not.
 *
 * A rejection here must leave the previous canonical project untouched, which is
 * why this returns a result rather than throwing or returning a partially
 * populated model: there is no "mostly decoded" project worth adopting.
 */
export function decodeNativeProjectModel(value: unknown): NativeProjectModelDecodeResult {
  if (!isRecord(value)) {
    return { status: 'rejected', reason: 'model.json is not an object' };
  }
  const { projectName, walls } = value;
  if (typeof projectName !== 'string') {
    return { status: 'rejected', reason: 'model.json has no project name' };
  }
  if (!Array.isArray(walls)) {
    return { status: 'rejected', reason: 'model.json has no wall list' };
  }

  const decoded: DrawnWall[] = [];
  const seenIds = new Set<string>();
  for (const [index, wall] of walls.entries()) {
    const result = decodeWall(wall, index);
    if (typeof result === 'string') {
      return { status: 'rejected', reason: result };
    }
    // Duplicate ids would make `applyOperation`'s per-id idempotence - and
    // therefore undo - depend on list position. Rejected rather than
    // de-duplicated, because silently dropping one of two walls a user can see
    // is a worse outcome than refusing to open a file that should not exist.
    if (seenIds.has(result.id)) {
      return { status: 'rejected', reason: `model.json repeats wall id ${result.id}` };
    }
    seenIds.add(result.id);
    decoded.push(result);
  }

  return { status: 'decoded', model: { projectName, walls: decoded } };
}

/**
 * The inverse. Branded coordinates are plain numbers at runtime, so this is
 * structural rather than lossy - written explicitly so the stored shape is
 * decided here and not by whatever happens to be in memory.
 */
export function encodeNativeProjectModel(model: NativeProjectModel): unknown {
  return {
    projectName: model.projectName,
    walls: model.walls.map((wall) => ({
      id: wall.id,
      start: { x: wall.start.x, y: wall.start.y },
      end: { x: wall.end.x, y: wall.end.y },
    })),
  };
}
