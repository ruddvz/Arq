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
  'inherited' | 'overridden' | 'calculated' | 'imported' | 'missing' | 'invalid';

export interface InspectorField {
  readonly key: string;
  readonly label: string;
  readonly kind: InspectorFieldStateKind;
  /** null for 'missing' - there is no value to show. */
  readonly displayValue: string | null;
  /** Set for 'inherited'/'overridden' (the source type) or 'imported' (the import origin). */
  readonly sourceLabel?: string;
  /** Set only for 'invalid' - "explain the valid range" (section 12). */
  readonly invalidReason?: string;
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
  return field.kind !== 'calculated' && field.kind !== 'missing';
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
  }
}
