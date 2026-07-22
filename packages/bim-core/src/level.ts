/**
 * ARQ-062: define level schema.
 *
 * Mirrors contracts/model.ts's existing Level interface exactly (same
 * duplication rationale as ids.ts, ARQ-060: contracts/ isn't wired up as
 * an importable workspace package yet). A level is a building storey:
 * an elevation (height above the project's datum) and an optional storey
 * height (floor-to-floor height, used to place the level above it).
 */

import type { LevelId } from './ids';

export interface Level {
  readonly id: LevelId;
  readonly name: string;
  readonly elevation: number;
  readonly storeyHeight?: number;
}

export interface CreateLevelInput {
  readonly id: LevelId;
  readonly name: string;
  readonly elevation: number;
  readonly storeyHeight?: number;
}

/** Constructs a Level, rejecting a non-finite elevation or a non-positive storey height. */
export function createLevel(input: CreateLevelInput): Level {
  if (!Number.isFinite(input.elevation)) {
    throw new RangeError('elevation must be a finite number');
  }
  if (
    input.storeyHeight !== undefined &&
    (!Number.isFinite(input.storeyHeight) || input.storeyHeight <= 0)
  ) {
    throw new RangeError('storeyHeight must be a positive finite number when provided');
  }
  return input.storeyHeight === undefined
    ? { id: input.id, name: input.name, elevation: input.elevation }
    : {
        id: input.id,
        name: input.name,
        elevation: input.elevation,
        storeyHeight: input.storeyHeight,
      };
}

/** Sorts levels by elevation, lowest first - the usual "ground floor to roof" reading order. */
export function sortLevelsByElevation(levels: readonly Level[]): readonly Level[] {
  return [...levels].sort((a, b) => a.elevation - b.elevation);
}
