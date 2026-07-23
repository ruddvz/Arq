/**
 * ARQ-153: add VoiceOver labels.
 *
 * Blueprint section 127 ("Canvas accessibility") lists what Release 1
 * must still provide even though "a technical canvas is difficult to
 * expose completely": among them, "selected object description" -
 * exactly the text a screen reader (VoiceOver, section 128's own named
 * target) announces when an element is selected. Section 126's
 * baseline separately requires "status not colour-only" - this
 * description includes warning counts as text, not a colour swatch.
 *
 * Deliberately built from data this repository already computes rather
 * than inventing a new accessibility-specific data source: the
 * Inspection epic's property groups (identity-property-group.ts,
 * ARQ-130; geometry-property-group.ts, ARQ-131; warnings-property-
 * group.ts, ARQ-134) already ARE the inspector's "selected object
 * description" and "list of warnings" (section 127) - this module is
 * the one additional step of turning them into a single, readable
 * sentence, not a second description of the same element.
 *
 * Lives in @arq/operations, not @arq/bim-core, for the same reason
 * ARQ-134's WarningsPropertyGroup does: it needs both bim-core's
 * property groups and operations' own WarningsPropertyGroup together,
 * and bim-core must not depend on operations.
 *
 * Only value-bearing property states are announced (`hasValue`,
 * property-state.ts, ARQ-064) - a `missing` name or measurement is
 * silently omitted rather than announced as "unknown" or "N/A", since
 * a screen-reader user does not need to be told about data that simply
 * does not apply to this element (the same distinction identity-
 * property-group.ts already draws between "missing" and "calculated").
 */

import { hasValue, type GeometryPropertyGroup, type IdentityPropertyGroup } from '@arq/bim-core';
import type { WarningsPropertyGroup } from './warnings-property-group';

function formatMeasurement(
  measurement: GeometryPropertyGroup['measurements'][number],
): string | null {
  if (measurement.quantity === 'length') {
    if (!hasValue(measurement.state)) {
      return null;
    }
    return `${measurement.key} ${measurement.state.value.value}${measurement.state.value.unit}`;
  }
  if (!hasValue(measurement.state)) {
    return null;
  }
  return `${measurement.key} ${measurement.state.value}`;
}

/**
 * Builds the single accessible-description sentence a screen reader
 * announces for a selected element: category, name (if any), every
 * value-bearing geometry measurement, and a warning count (only when
 * there is at least one) - joined as a comma-separated sentence
 * fragment, e.g. "Wall, Interior Wall 100mm, height 2400mm, length
 * 4000mm, 2 warnings".
 */
export function describeSelectedElementForAccessibility(
  identity: IdentityPropertyGroup,
  geometry: GeometryPropertyGroup,
  warnings: WarningsPropertyGroup,
): string {
  const parts: string[] = [];

  if (hasValue(identity.category)) {
    parts.push(identity.category.value);
  }
  if (hasValue(identity.name)) {
    parts.push(identity.name.value);
  }
  for (const measurement of geometry.measurements) {
    const formatted = formatMeasurement(measurement);
    if (formatted !== null) {
      parts.push(formatted);
    }
  }
  if (warnings.messages.length > 0) {
    const count = warnings.messages.length;
    parts.push(`${count} warning${count === 1 ? '' : 's'}`);
  }

  return parts.join(', ');
}
