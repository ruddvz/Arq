/**
 * ARQ-107: define window type and instance (type half).
 *
 * The shared, reusable definition a Window instance (window-instance.ts)
 * points to - blueprint section 47 lists a window's properties as type,
 * width, height, sill, host, offset, side, level, mark (later); "type"
 * is one of them, the same split WallType/Wall (ARQ-091) and
 * DoorType/Door (ARQ-104) already establish.
 *
 * Unlike DoorType, which has no defaultSillHeight (section 46 treats a
 * door's sill as normally a fixed convention - zero - rather than a
 * per-type catalog value), a window's sill height genuinely varies by
 * type (a standard sill height vs. a full-height window are different
 * catalog items, not the same type placed differently), so WindowType
 * owns defaultSillHeight alongside defaultWidth/defaultHeight - a
 * deliberate difference from DoorType, not an oversight.
 *
 * No contracts/model.ts counterpart exists for this (that file predates
 * the window type/instance split), so this is a new declaration by
 * extension of the WallType/DoorType pattern, same as door-type.ts.
 */

import type { Length } from './length';
import type { WindowTypeId } from './ids';

export interface WindowType {
  readonly id: WindowTypeId;
  readonly name: string;
  readonly defaultWidth: Length;
  readonly defaultHeight: Length;
  readonly defaultSillHeight: Length;
}

/** What changing a WindowType's defaults invalidates downstream - see this module's doc comment. Only affects future windows created from this type; existing Openings already hold their own concrete width/height/sillHeight. */
export const WINDOW_TYPE_DERIVED_INVALIDATIONS = [
  'dimensions',
  'plan-render-cache',
  'mesh-3d',
] as const;

export interface CreateWindowTypeInput {
  readonly id: WindowTypeId;
  readonly name: string;
  readonly defaultWidth: Length;
  readonly defaultHeight: Length;
  readonly defaultSillHeight: Length;
}

/** Constructs a WindowType, rejecting a non-positive defaultWidth/defaultHeight or a negative defaultSillHeight. */
export function createWindowType(input: CreateWindowTypeInput): WindowType {
  if (!Number.isFinite(input.defaultWidth.value) || input.defaultWidth.value <= 0) {
    throw new RangeError('defaultWidth must be a positive finite length');
  }
  if (!Number.isFinite(input.defaultHeight.value) || input.defaultHeight.value <= 0) {
    throw new RangeError('defaultHeight must be a positive finite length');
  }
  if (!Number.isFinite(input.defaultSillHeight.value) || input.defaultSillHeight.value < 0) {
    throw new RangeError('defaultSillHeight must be a non-negative finite length');
  }
  return {
    id: input.id,
    name: input.name,
    defaultWidth: input.defaultWidth,
    defaultHeight: input.defaultHeight,
    defaultSillHeight: input.defaultSillHeight,
  };
}
