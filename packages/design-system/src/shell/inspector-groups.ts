/**
 * ARQ-026: build inspector shell.
 *
 * Blueprint section 12 > "Right inspector": eleven groups in this fixed
 * order - Identity, Geometry, Placement, Type, Instance, Relationships,
 * Constraints, Visibility, Source, Warnings, History. Rules modelled here:
 * "inherited values show their source" (`InspectorField.sourceLabel`);
 * "overridden values show an override marker" (`hasOverrideMarker`);
 * "calculated values are read-only unless a controlling parameter exists"
 * (`isFieldEditable` - a calculated field is never editable by this
 * module's own rule, since it has no notion of a "controlling parameter"
 * to defer to); "invalid fields remain editable and explain the valid
 * range" (`isFieldEditable` returns true for 'invalid', and
 * `describeFieldState` surfaces `invalidReason`).
 *
 * `InspectorField`'s `kind` values mirror @arq/bim-core's `PropertyState`
 * kinds (inherited/overridden/calculated/imported/missing/invalid) by
 * value, not by import - the same domain-agnostic layering choice
 * plan-renderer's snap-glyph-rendering.ts already made: this is a UI-shell
 * package, so a caller (which does depend on @arq/bim-core/@arq/operations)
 * maps its real PropertyState/WarningsPropertyGroup/HistoryPropertyGroup
 * data into this shape, not the other way around.
 *
 * "This is a shell" (the issue's own title): only Identity, Geometry, Type,
 * Instance, Relationships, Warnings, and History currently have a real data
 * source anywhere in this repository (the bim-core/operations property-group
 * modules) - Placement, Constraints, Visibility, and Source have no
 * property-group module yet, so `buildEmptyInspectorGroups` renders them
 * with zero fields (an honest empty state), not fabricated content.
 */

export type InspectorFieldStateKind =
  | 'inherited'
  | 'overridden'
  | 'calculated'
  | 'imported'
  | 'missing'
  | 'invalid'
  /**
   * Several elements are selected and they do not agree on this property.
   *
   * Distinct from 'missing': the value exists on each element, they simply
   * differ, and reporting one of them would describe the selection wrongly.
   */
  | 'mixed';

export interface InspectorField {
  readonly key: string;
  readonly label: string;
  readonly kind: InspectorFieldStateKind;
  /** null for 'missing' and 'mixed' - there is no single value to show. */
  readonly displayValue: string | null;
  /** Set for 'inherited'/'overridden' (the source type) or 'imported' (the import origin). */
  readonly sourceLabel?: string;
  /** Set only for 'invalid' - "explain the valid range" (section 12). */
  readonly invalidReason?: string;
  /**
   * Overrides the editability that `kind` would otherwise imply.
   *
   * Set by `mergeInspectorFields`, which is the one place that knows something
   * `kind` cannot express: a mixed field is editable only when every element
   * behind it was. Without this a mixed row built from calculated values would
   * offer an edit that has nowhere to go.
   */
  readonly editable?: boolean;
}

export const INSPECTOR_GROUP_IDS = [
  'identity',
  'geometry',
  'placement',
  'type',
  'instance',
  'relationships',
  'constraints',
  'visibility',
  'source',
  'warnings',
  'history',
] as const;

export type InspectorGroupId = (typeof INSPECTOR_GROUP_IDS)[number];

export const INSPECTOR_GROUP_LABEL: Readonly<Record<InspectorGroupId, string>> = {
  identity: 'Identity',
  geometry: 'Geometry',
  placement: 'Placement',
  type: 'Type',
  instance: 'Instance',
  relationships: 'Relationships',
  constraints: 'Constraints',
  visibility: 'Visibility',
  source: 'Source',
  warnings: 'Warnings',
  history: 'History',
};

/** Warnings and History are message/entry lists, not key-value fields - a distinct content shape from the other nine groups. */
export type InspectorGroupContent =
  | { readonly kind: 'fields'; readonly fields: readonly InspectorField[] }
  | { readonly kind: 'lines'; readonly lines: readonly string[] };

export interface InspectorGroup {
  readonly id: InspectorGroupId;
  readonly label: string;
  readonly content: InspectorGroupContent;
}

const LINE_GROUPS: ReadonlySet<InspectorGroupId> = new Set(['warnings', 'history']);

/** The inspector shell with every group present but empty - no element selected, or no data source wired for that group yet. */
export function buildEmptyInspectorGroups(): readonly InspectorGroup[] {
  return INSPECTOR_GROUP_IDS.map((id) => ({
    id,
    label: INSPECTOR_GROUP_LABEL[id],
    content: LINE_GROUPS.has(id) ? { kind: 'lines', lines: [] } : { kind: 'fields', fields: [] },
  }));
}

/** Section 12: "overridden values show an override marker." */
export function hasOverrideMarker(field: InspectorField): boolean {
  return field.kind === 'overridden';
}

/** Section 12: "calculated values are read-only"; "invalid fields remain editable." */
export function isFieldEditable(field: InspectorField): boolean {
  if (field.editable !== undefined) {
    return field.editable;
  }
  return field.kind !== 'calculated' && field.kind !== 'missing';
}

/**
 * Collapse one element's worth of fields per selected element into the rows an
 * inspector shows for the whole selection.
 *
 * The failure this fixes: with three walls selected the inspector showed the
 * first one's id and length, under a heading that said three were selected. Not
 * a display quirk - it named one element's measurements as the selection's, so
 * a reader checking a length got an answer about a wall they had not asked
 * about, with nothing on screen saying so.
 *
 * A property survives only if every element agrees on it, value and state
 * alike. Anything else becomes 'mixed', which is deliberately not 'missing':
 * the value exists on each element, they simply differ.
 *
 * A key that only some elements carry is also mixed. The elements that lack it
 * disagree about it as surely as ones holding a different value do, and the
 * alternative - showing the value from whichever elements happen to have it -
 * is the original bug in miniature.
 */
export function mergeInspectorFields(
  perElement: readonly (readonly InspectorField[])[],
): readonly InspectorField[] {
  const present = perElement.filter((fields) => fields.length > 0);
  if (present.length === 0) {
    return [];
  }
  if (present.length === 1) {
    return present[0]!;
  }

  // Key order follows the first element, so a selection does not reorder rows
  // relative to inspecting one of its members.
  const orderedKeys: string[] = [];
  const seen = new Set<string>();
  for (const fields of present) {
    for (const field of fields) {
      if (!seen.has(field.key)) {
        seen.add(field.key);
        orderedKeys.push(field.key);
      }
    }
  }

  return orderedKeys.map((key) => {
    const matches = present.map((fields) => fields.find((field) => field.key === key));
    const found = matches.filter((field): field is InspectorField => field !== undefined);
    const label = found[0]?.label ?? key;
    const first = found[0]!;

    const everyElementHasIt = found.length === present.length;
    const agrees =
      everyElementHasIt &&
      found.every(
        (field) => field.kind === first.kind && field.displayValue === first.displayValue,
      );

    if (agrees) {
      return first;
    }
    return {
      key,
      label,
      kind: 'mixed' as const,
      displayValue: null,
      // Editable only if every contributing element's own field was, so a mixed
      // row built from calculated values does not offer an edit with nowhere to
      // go.
      editable: everyElementHasIt && found.every(isFieldEditable),
    };
  });
}

/**
 * Section 12: "inherited values show their source" / "invalid fields ...
 * explain the valid range." One human-readable line per field, covering
 * every `kind` so a caller never has to guess how to annotate one.
 */
export function describeFieldState(field: InspectorField): string {
  switch (field.kind) {
    case 'inherited':
      return `Inherited from ${field.sourceLabel ?? 'type'}`;
    case 'overridden':
      return `Overridden (was ${field.sourceLabel ?? 'type'})`;
    case 'calculated':
      return 'Calculated';
    case 'imported':
      return `Imported from ${field.sourceLabel ?? 'external file'}`;
    case 'missing':
      return 'Not set';
    case 'invalid':
      return field.invalidReason ?? 'Invalid value';
    case 'mixed':
      // Says what is true of the selection rather than of any one element, and
      // avoids "varies" - a reader has to know whether the field is empty or
      // simply not shared.
      return 'Multiple values';
  }
}
