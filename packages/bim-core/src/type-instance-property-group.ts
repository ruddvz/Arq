/**
 * ARQ-132: build type and instance group.
 *
 * docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md section
 * 12 ("Right inspector") lists "Type" and "Instance" as their own
 * inspector groups, and section 35 ("Type and instance") names the
 * inspector behaviour they exist to support: "show source type", "reset
 * override", "bulk edit with affected count". This module builds the
 * one piece of that behaviour that is a pure read-model over data this
 * repository already computes - which type an element uses, and which
 * of its properties are currently overridden - rather than the
 * state-changing operations themselves ("promote repeated overrides
 * into a new type with preview", "bulk edit") or "version reusable
 * definitions later" and "prevent cyclic inheritance" (both explicitly
 * "later" in section 35, and no type-of-type inheritance graph exists
 * in this codebase to have cycles in), all of which are excluded by
 * this issue's own "do not expand into later release scope" non-goal.
 *
 * Deliberately generic over `NamedPropertyState` rather than importing
 * identity-property-group.ts/geometry-property-group.ts: this group's
 * job is to summarise overrides across *whichever* PropertyState-typed
 * fields a caller has already resolved (Identity's name, Geometry's
 * measurements, or any future group), not to know their shapes - the
 * same reasoning identity-property-group.ts used for not importing
 * Wall/Door/Room, applied one level up.
 *
 * `type` mirrors identity-property-group.ts's own `type` field
 * (id + name, Calculated when present) rather than duplicating a
 * separate representation - Missing for typeless elements like Room.
 */

import { calculatedProperty, missingProperty, type PropertyState } from './property-state';

export interface TypeReference {
  readonly id: string;
  readonly name: string;
}

export interface NamedPropertyState {
  readonly key: string;
  readonly state: PropertyState<unknown>;
}

export interface TypeAndInstancePropertyGroup {
  readonly type: PropertyState<TypeReference>;
  /** Keys (from the `properties` given to the builder) currently in the 'overridden' state - what "bulk edit with affected count" and "promote to a new type" both need to know. */
  readonly overriddenPropertyKeys: readonly string[];
}

export function buildTypeAndInstancePropertyGroup(
  type: TypeReference | undefined,
  properties: readonly NamedPropertyState[],
): TypeAndInstancePropertyGroup {
  return {
    type: type === undefined ? missingProperty() : calculatedProperty(type),
    overriddenPropertyKeys: properties
      .filter((property) => property.state.kind === 'overridden')
      .map((property) => property.key),
  };
}
