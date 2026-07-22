/**
 * ARQ-107: define window type and instance (instance half).
 *
 * A single window placed in a project, hosted through an Opening
 * (opening.ts, ARQ-103) - the same host-by-reference relationship
 * Door has with its Opening (door-instance.ts, ARQ-104). Blueprint
 * section 47 lists a window's properties as type, width, height, sill,
 * host, offset, side, level, mark (later): host/offset/width/height/
 * sill are already Opening's fields, so Window does not duplicate them.
 * That leaves typeId, openingId, levelId, and side as this instance's
 * own fields.
 *
 * Deliberately narrower than Door: section 47 says "Interactions match
 * doors where meaningful" - a window has no hinge, so there is no hand
 * or swingAngle here, unlike Door. flipSide is meaningful (which face
 * of the host the window's reveal/sill detail faces) and is included;
 * there is no flipHand for the same reason DoorHand doesn't apply.
 * `mark` is explicitly "later" per the blueprint and is not included,
 * matching Door.
 *
 * Type-instance behaviour: the same read-by-comparison approach
 * resolveDoorWidth/resolveDoorHeight use (door-instance.ts) - a placed
 * window's Opening always holds concrete width/height/sillHeight, so
 * there is no stored override flag; resolveWindowWidth/Height/SillHeight
 * classify Inherited (still matches the WindowType's current default)
 * vs. Overridden (was placed or resized away from it) by comparison.
 *
 * Stable IDs: WindowId (ids.ts, ARQ-107) never changes for the life of
 * the window, including flipSide (a property update), same rationale
 * as WallId/DoorId surviving their own instance-level edits.
 *
 * Derived invalidations: flipSide changes which way the window reads
 * on plan, so it invalidates the same render/dimension set
 * WINDOW_TYPE_DERIVED_INVALIDATIONS (window-type.ts) already declares
 * for a type-level default change - reused rather than re-declared,
 * same pattern as door-instance.ts's flipSide/flipHand.
 *
 * Placing a window (constructing its Opening from a WindowType's
 * defaults, choosing a host wall and offset, snapping) is future
 * editor work, not this module's job - out of scope here the same way
 * door placement was ARQ-105's job, not door-instance.ts's (ARQ-104).
 */

import type { LevelId, OpeningId, WindowId, WindowTypeId } from './ids';
import type { Length } from './length';
import { lengthsAreEqual } from './length';
import type { Opening } from './opening';
import { inheritedProperty, overriddenProperty, type PropertyState } from './property-state';
import type { WindowType } from './window-type';

export type WindowSide = 'left' | 'right';

export interface Window {
  readonly id: WindowId;
  readonly typeId: WindowTypeId;
  readonly openingId: OpeningId;
  readonly levelId: LevelId;
  readonly side: WindowSide;
}

export interface CreateWindowInput {
  readonly id: WindowId;
  readonly typeId: WindowTypeId;
  readonly openingId: OpeningId;
  readonly levelId: LevelId;
  readonly side?: WindowSide;
}

/** Constructs a Window, defaulting side to 'right'. */
export function createWindow(input: CreateWindowInput): Window {
  return {
    id: input.id,
    typeId: input.typeId,
    openingId: input.openingId,
    levelId: input.levelId,
    side: input.side ?? 'right',
  };
}

/** Section 47's "interactions match doors where meaningful" - flip side: swaps which face of the host the window faces. */
export function flipWindowSide(window: Window): Window {
  return { ...window, side: window.side === 'left' ? 'right' : 'left' };
}

/** The window's effective width as a PropertyState: Inherited while its Opening's width still matches the WindowType's current default, Overridden once it doesn't. */
export function resolveWindowWidth(
  window: Window,
  windowType: WindowType,
  opening: Opening,
): PropertyState<Length> {
  return lengthsAreEqual(opening.width, windowType.defaultWidth)
    ? inheritedProperty(windowType.defaultWidth, windowType.id)
    : overriddenProperty(opening.width, windowType.id);
}

/** The window's effective height as a PropertyState: Inherited while its Opening's height still matches the WindowType's current default, Overridden once it doesn't. */
export function resolveWindowHeight(
  window: Window,
  windowType: WindowType,
  opening: Opening,
): PropertyState<Length> {
  return lengthsAreEqual(opening.height, windowType.defaultHeight)
    ? inheritedProperty(windowType.defaultHeight, windowType.id)
    : overriddenProperty(opening.height, windowType.id);
}

/** The window's effective sill height as a PropertyState: Inherited while its Opening's sillHeight still matches the WindowType's current default, Overridden once it doesn't. */
export function resolveWindowSillHeight(
  window: Window,
  windowType: WindowType,
  opening: Opening,
): PropertyState<Length> {
  return lengthsAreEqual(opening.sillHeight, windowType.defaultSillHeight)
    ? inheritedProperty(windowType.defaultSillHeight, windowType.id)
    : overriddenProperty(opening.sillHeight, windowType.id);
}
