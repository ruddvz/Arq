/**
 * ARQ-133: build relationships group.
 *
 * docs/product/ARQ-COMPLETE-PRODUCT-ENGINEERING-BLUEPRINT-v1.0.md section
 * 12 ("Right inspector") lists "Relationships" as its own group. This
 * repository already models several of these links directly on the
 * entities themselves - Wall.hostedOpeningIds, Opening.hostWallId,
 * Room.boundaryElementIds (room.ts/opening.ts/wall-instance.ts) - so,
 * exactly like geometry-property-group.ts, *which* relationships apply
 * varies by category (a Wall hosts openings; an Opening is hosted by a
 * wall; a Room references its boundary elements) rather than sharing one
 * fixed shape, so this group is a named list too, with the same
 * duplicate-key invariant geometry-property-group.ts already
 * established (the inspector renders one row per key).
 *
 * `relatedIds` is a PropertyState<readonly string[]> rather than a bare
 * array so a category-agnostic caller can distinguish "calculated and
 * currently empty" (a wall with zero hosted openings - a normal,
 * expected state) from "missing" (the relationship kind does not apply
 * to this element at all, e.g. a Room has no hostWallId concept) - the
 * same missing-vs-empty distinction identity-property-group.ts already
 * draws for levelId/ifcGlobalId/dxfHandle.
 *
 * Deliberately excludes any traversal/graph-walking logic (e.g. "find
 * every element transitively related to this one") - that is squarely
 * "later release scope" per this issue's own non-goal, and section 36's
 * "derived dependency graph" (invalidation on change) is a distinct,
 * already-separate concern from what the inspector displays.
 */

import { missingProperty, type PropertyState } from './property-state';

export type RelationshipKind = 'hosts' | 'hostedBy' | 'references' | 'referencedBy';

export interface RelationshipEntry {
  readonly key: string;
  readonly kind: RelationshipKind;
  readonly relatedIds: PropertyState<readonly string[]>;
}

export interface RelationshipsPropertyGroup {
  readonly relationships: readonly RelationshipEntry[];
}

export function relationshipEntry(
  key: string,
  kind: RelationshipKind,
  relatedIds: readonly string[],
): RelationshipEntry {
  return { key, kind, relatedIds: { kind: 'calculated', value: [...relatedIds] } };
}

export function missingRelationshipEntry(key: string, kind: RelationshipKind): RelationshipEntry {
  return { key, kind, relatedIds: missingProperty() };
}

/** Builds a RelationshipsPropertyGroup, rejecting duplicate keys (the inspector renders one row per key). */
export function buildRelationshipsPropertyGroup(
  entries: readonly RelationshipEntry[],
): RelationshipsPropertyGroup {
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.key)) {
      throw new RangeError(`duplicate relationship key: ${entry.key}`);
    }
    seen.add(entry.key);
  }
  return { relationships: [...entries] };
}

/** Looks up a relationship entry by key - the shape an inspector row actually needs to render. */
export function findRelationshipEntry(
  group: RelationshipsPropertyGroup,
  key: string,
): RelationshipEntry | undefined {
  return group.relationships.find((entry) => entry.key === key);
}
