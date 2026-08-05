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
import {
  parseNativeProjectModel,
  type NativeProjectModel as NativeProjectDocument,
} from '@arq/project-loading';
import type { DrawnWall } from '../canvas/plan-document';

/**
 * A decoded `model.json`, from either of the two shapes that legitimately
 * appear in one.
 *
 * The flat shape is what this build writes: a project name and a wall list, and
 * nothing the plan canvas cannot already edit. The reference shape is the actual
 * Arq project model - a project summary with its own revision, levels, wall
 * types, rooms and views - which a project authored anywhere else carries and
 * which has no root `projectName` at all. Decoding only the first meant the
 * product could open the files it had written and refused the reference fixture
 * with "model.json has no project name".
 *
 * `walls` is the common denominator both shapes can always supply, so the plan
 * canvas needs no knowledge of which one arrived. `document` is the richer model
 * when there was one, for the surfaces that can show more than walls.
 */
export interface NativeProjectModel {
  readonly projectName: string;
  readonly walls: readonly DrawnWall[];
  /** The reference-format document, or null for a project this build wrote. */
  readonly document: NativeProjectDocument | null;
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
  // No root project name means this is not the flat shape. Before rejecting,
  // try the reference model - the format a project written by anything other
  // than this build actually uses.
  if (typeof projectName !== 'string') {
    return decodeReferenceModel(value);
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

  return { status: 'decoded', model: { projectName, walls: decoded, document: null } };
}

/**
 * The reference project model. Validation belongs to `@arq/project-loading`,
 * which refuses a model whose walls point at levels or types it does not
 * contain; this only projects the result onto what the plan canvas draws.
 *
 * The walls need no coordinate re-validation here: the parser has already built
 * them through the branded constructors, so re-deriving them would be a second
 * opinion about the same bytes rather than a check.
 */
function decodeReferenceModel(value: unknown): NativeProjectModelDecodeResult {
  const parsed = parseNativeProjectModel(value);
  if (parsed.status === 'rejected') {
    return { status: 'rejected', reason: parsed.reason };
  }
  const document = parsed.model;
  return {
    status: 'decoded',
    model: {
      projectName: document.summary.projectName,
      walls: document.walls.map((wall) => ({ id: wall.id, start: wall.start, end: wall.end })),
      document,
    },
  };
}

/**
 * The inverse. Branded coordinates are plain numbers at runtime, so this is
 * structural rather than lossy - written explicitly so the stored shape is
 * decided here and not by whatever happens to be in memory.
 */
export function encodeNativeProjectModel(
  model: Pick<NativeProjectModel, 'projectName' | 'walls'>,
): unknown {
  return {
    projectName: model.projectName,
    walls: model.walls.map((wall) => ({
      id: wall.id,
      start: { x: wall.start.x, y: wall.start.y },
      end: { x: wall.end.x, y: wall.end.y },
    })),
  };
}
