/**
 * ARQ-131: build geometry property group.
 *
 * docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md section
 * 12 ("Right inspector") lists "Geometry" as its own group, distinct from
 * "Placement" (position/level - not this issue) and "Type"/"Instance"
 * (ARQ-132). Unlike identity-property-group.ts's fixed field set (every
 * element has exactly one id/category/name), *which* geometric facts
 * apply varies genuinely by category: a Wall has length/thickness/
 * height, an Opening has width/height/sillHeight, a Room has only area.
 * Forcing one fixed shape across all of them would either omit real
 * facts or invent empty ones, so this group is a named list instead -
 * each category's own adapter (a later, category-specific concern, not
 * this issue) decides which measurements to include and in what order.
 *
 * Kept generic over quantity kind (length/area/angle) rather than
 * collapsing everything to a bare number, so a length measurement keeps
 * @arq/bim-core's own unit tagging (length.ts, ARQ-059) all the way
 * into the inspector, instead of silently assuming a fixed display
 * unit. Area stays a plain number in square metres, matching
 * room-area.ts (ARQ-114)'s own decision not to introduce a typed Area
 * unit. Angle is radians per section 34 ("Units").
 *
 * Every measurement value is still a PropertyState (property-state.ts,
 * ARQ-064), for the same reason identity-property-group.ts wraps its
 * fields: the Right inspector's rules ("inherited values show their
 * source; overridden values show an override marker; calculated values
 * are read-only unless a controlling parameter exists") apply to every
 * group, including Geometry - a wall's height is Inherited/Overridden
 * exactly as resolveWallHeight (wall-instance.ts, ARQ-092) already
 * models it, and its length is Calculated (derived from start/end, not
 * something a type provides or an instance overrides).
 *
 * buildGeometryPropertyGroup's one real invariant: measurement keys
 * must be unique within a group, since the inspector renders one row
 * per key and a duplicate would silently shadow another row rather
 * than signal the caller's mistake.
 */

import type { Length } from './length';
import type { PropertyState } from './property-state';

export type GeometryQuantityKind = 'length' | 'area' | 'angle';

export type GeometryMeasurement =
  | { readonly key: string; readonly quantity: 'length'; readonly state: PropertyState<Length> }
  | { readonly key: string; readonly quantity: 'area'; readonly state: PropertyState<number> }
  | { readonly key: string; readonly quantity: 'angle'; readonly state: PropertyState<number> };

export interface GeometryPropertyGroup {
  readonly measurements: readonly GeometryMeasurement[];
}

export function lengthMeasurement(key: string, state: PropertyState<Length>): GeometryMeasurement {
  return { key, quantity: 'length', state };
}

export function areaMeasurement(key: string, state: PropertyState<number>): GeometryMeasurement {
  return { key, quantity: 'area', state };
}

export function angleMeasurement(key: string, state: PropertyState<number>): GeometryMeasurement {
  return { key, quantity: 'angle', state };
}

/** Builds a GeometryPropertyGroup, rejecting duplicate measurement keys (the inspector renders one row per key). */
export function buildGeometryPropertyGroup(
  measurements: readonly GeometryMeasurement[],
): GeometryPropertyGroup {
  const seen = new Set<string>();
  for (const measurement of measurements) {
    if (seen.has(measurement.key)) {
      throw new RangeError(`duplicate geometry measurement key: ${measurement.key}`);
    }
    seen.add(measurement.key);
  }
  return { measurements: [...measurements] };
}

/** Looks up a measurement by key - the shape an inspector row actually needs to render. */
export function findGeometryMeasurement(
  group: GeometryPropertyGroup,
  key: string,
): GeometryMeasurement | undefined {
  return group.measurements.find((measurement) => measurement.key === key);
}
