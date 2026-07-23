/**
 * ARQ-169: ai: prototype explain selection.
 *
 * Blueprint section 100's "First user-facing AI, Feature 1: Explain
 * selection" lists what to explain: what object it is; inherited
 * properties; overrides; host; room relationships; warnings; effect of
 * changing a property. Like ARQ-153's
 * describeSelectedElementForAccessibility (accessible-selection-
 * description.ts), this is built entirely from property groups this
 * repository already computes (identity, type/instance, relationships,
 * warnings) - not a new data source, and reuses that module's own
 * summary sentence for "what object it is" rather than writing a second
 * one.
 *
 * "Inherited properties" is derived from the same `namedProperties` list
 * a caller already passes to `buildTypeAndInstancePropertyGroup`
 * (type-instance-property-group.ts, ARQ-132) - that group's own output
 * keeps only `overriddenPropertyKeys`, discarding which keys are
 * 'inherited' (a property inherited from its type but not overridden),
 * so this module re-derives that list from the same input rather than
 * widening ARQ-132's already-shipped output shape for one new caller.
 *
 * "Host" and "room relationships" both come from RelationshipsPropertyGroup
 * (relationships-property-group.ts, ARQ-133): `kind: 'hostedBy'` is
 * surfaced as `host` specifically (section 100 names it separately); every
 * other relationship entry (a Room's `boundaryElements`, a Wall's
 * `hostedOpenings`, ...) is surfaced generically as `relationships` -
 * this module does not hardcode "room" string-matching against a key
 * name to split them further, since which keys are room-related is
 * exactly the caller-chosen key name already visible in the result.
 *
 * "Effect of changing a property" is deliberately NOT included: producing
 * that explanation needs a real preview of section 36's "invalidation
 * set" for a hypothetical (not-yet-applied) property change, which does
 * not exist anywhere in this repository today (the closest real thing,
 * `OperationResult.invalidations` in operation.ts, describes the effect
 * of an operation already applied, not a hypothetical one under
 * consideration) - inventing a fabricated or guessed answer here would
 * be exactly the kind of unlabelled claim docs/ai/AI-GUARDRAILS.md rules
 * out ("No unlabelled assumptions"). This gap is intentional and
 * documented, not silently missing.
 */

import {
  hasValue,
  type GeometryPropertyGroup,
  type IdentityPropertyGroup,
  type NamedPropertyState,
  type RelationshipsPropertyGroup,
  type TypeAndInstancePropertyGroup,
} from '@arq/bim-core';
import { describeSelectedElementForAccessibility } from './accessible-selection-description';
import type { WarningsPropertyGroup } from './warnings-property-group';

export interface RelationshipSummary {
  readonly key: string;
  readonly relatedIds: readonly string[];
}

export interface SelectionExplanation {
  /** "What object it is" - the same sentence describeSelectedElementForAccessibility already builds. */
  readonly summary: string;
  readonly inheritedProperties: readonly string[];
  readonly overriddenProperties: readonly string[];
  /** The related id of this element's 'hostedBy' relationship, or null when it has none (e.g. a Wall is never hosted). */
  readonly host: string | null;
  /** Every relationship other than 'hostedBy' (already surfaced as `host`) - includes room-boundary/hosts-openings style entries under their own caller-chosen key. */
  readonly relationships: readonly RelationshipSummary[];
  /** Full warning text (title), not just a count - "explain" needs the actual message, unlike the terser accessibility summary. */
  readonly warnings: readonly string[];
}

/** Builds a structured, previewable explanation of the current selection. */
export function explainSelection(
  identity: IdentityPropertyGroup,
  geometry: GeometryPropertyGroup,
  typeAndInstance: TypeAndInstancePropertyGroup,
  namedProperties: readonly NamedPropertyState[],
  relationshipsGroup: RelationshipsPropertyGroup,
  warnings: WarningsPropertyGroup,
): SelectionExplanation {
  const summary = describeSelectedElementForAccessibility(identity, geometry, warnings);

  const inheritedProperties = namedProperties
    .filter((property) => property.state.kind === 'inherited')
    .map((property) => property.key);

  let host: string | null = null;
  const relationships: RelationshipSummary[] = [];
  for (const entry of relationshipsGroup.relationships) {
    if (!hasValue(entry.relatedIds) || entry.relatedIds.value.length === 0) {
      continue;
    }
    if (entry.kind === 'hostedBy') {
      host = entry.relatedIds.value[0] ?? null;
      continue;
    }
    relationships.push({ key: entry.key, relatedIds: entry.relatedIds.value });
  }

  return {
    summary,
    inheritedProperties,
    overriddenProperties: typeAndInstance.overriddenPropertyKeys,
    host,
    relationships,
    warnings: warnings.messages.map((message) => message.title),
  };
}
