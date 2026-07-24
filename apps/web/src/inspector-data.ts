import {
  buildGeometryPropertyGroup,
  buildIdentityPropertyGroup,
  buildRelationshipsPropertyGroup,
  buildTypeAndInstancePropertyGroup,
  calculatedProperty,
  elementId,
  inheritedProperty,
  lengthMeasurement,
  length as makeLength,
  relationshipEntry,
  type Length,
  type PropertyState,
} from '@arq/bim-core';
import {
  buildHistoryPropertyGroup,
  buildWarningsPropertyGroup,
  describeSelectedElementForAccessibility,
} from '@arq/operations';
import {
  buildEmptyInspectorGroups,
  type InspectorField,
  type InspectorGroup,
} from '@arq/design-system';

/**
 * Maps @arq/bim-core's PropertyState (identity/geometry/type-instance/
 * relationships) into @arq/design-system's decoupled InspectorField shape -
 * the one place allowed to depend on both, since apps/web is the actual
 * consumer of the domain model, unlike the UI-shell package itself (see
 * inspector-groups.ts's own doc comment on why it stays domain-agnostic).
 */
function propertyStateToInspectorField<T>(
  key: string,
  label: string,
  state: PropertyState<T>,
  formatValue: (value: T) => string,
): InspectorField {
  if (state.kind === 'missing') {
    return { key, label, kind: 'missing', displayValue: null };
  }
  if (state.kind === 'invalid') {
    return {
      key,
      label,
      kind: 'invalid',
      displayValue: String(state.rawValue),
      invalidReason: state.reason,
    };
  }
  if (state.kind === 'inherited' || state.kind === 'overridden') {
    return {
      key,
      label,
      kind: state.kind,
      displayValue: formatValue(state.value),
      sourceLabel: state.sourceTypeId,
    };
  }
  if (state.kind === 'imported') {
    return {
      key,
      label,
      kind: 'imported',
      displayValue: formatValue(state.value),
      sourceLabel: state.importSource,
    };
  }
  return { key, label, kind: 'calculated', displayValue: formatValue(state.value) };
}

const formatLength = (value: Length): string => `${value.value}${value.unit}`;
const formatNumber = (value: number): string => String(value);
const formatIds = (ids: readonly string[]): string => (ids.length === 0 ? 'None' : ids.join(', '));

const DEMO_WALL_ID = elementId('demo-wall-1');
const DEMO_WALL_TYPE = { id: 'wt-interior-100', name: 'Interior 100mm' };

/**
 * Builds the inspector groups for the one demo wall PlanCanvas draws
 * (apps/web has no real project/document model yet - see PlanCanvas's own
 * doc comment) - real property-group builders, real example values, so
 * the inspector shell's data path is proven end to end rather than only
 * unit-tested in isolation.
 */
function buildDemoWallPropertyGroups() {
  const identity = buildIdentityPropertyGroup({
    id: DEMO_WALL_ID,
    category: 'Wall',
    levelId: 'level-1',
    type: DEMO_WALL_TYPE,
  });
  const geometry = buildGeometryPropertyGroup([
    lengthMeasurement('length', inheritedProperty(makeLength(4200, 'mm'), DEMO_WALL_TYPE.id)),
    lengthMeasurement('height', calculatedProperty(makeLength(2400, 'mm'))),
  ]);
  const typeAndInstance = buildTypeAndInstancePropertyGroup(DEMO_WALL_TYPE, [
    { key: 'height', state: calculatedProperty(2400) },
  ]);
  const relationships = buildRelationshipsPropertyGroup([
    relationshipEntry('hostedOpenings', 'hosts', []),
  ]);
  const warnings = buildWarningsPropertyGroup(DEMO_WALL_ID, []);
  const history = buildHistoryPropertyGroup(DEMO_WALL_ID, []);
  return { identity, geometry, typeAndInstance, relationships, warnings, history };
}

/** Blueprint section 127 ("Canvas accessibility"): the selected-object description a screen reader announces - built from the same real property groups as the inspector, per describeSelectedElementForAccessibility's own doc comment. */
export function buildDemoWallAccessibleDescription(): string {
  const { identity, geometry, warnings } = buildDemoWallPropertyGroups();
  return describeSelectedElementForAccessibility(identity, geometry, warnings);
}

export function buildDemoWallInspectorGroups(): readonly InspectorGroup[] {
  const { identity, geometry, typeAndInstance, relationships, warnings, history } =
    buildDemoWallPropertyGroups();

  const groupById = new Map(buildEmptyInspectorGroups().map((group) => [group.id, group]));

  groupById.set('identity', {
    id: 'identity',
    label: 'Identity',
    content: {
      kind: 'fields',
      fields: [
        propertyStateToInspectorField('id', 'ID', identity.id, (v) => v),
        propertyStateToInspectorField('category', 'Category', identity.category, (v) => v),
        propertyStateToInspectorField('name', 'Name', identity.name, (v) => v),
      ],
    },
  });
  groupById.set('geometry', {
    id: 'geometry',
    label: 'Geometry',
    content: {
      kind: 'fields',
      fields: geometry.measurements.map((measurement) =>
        measurement.quantity === 'length'
          ? propertyStateToInspectorField(
              measurement.key,
              measurement.key,
              measurement.state,
              formatLength,
            )
          : propertyStateToInspectorField(
              measurement.key,
              measurement.key,
              measurement.state,
              formatNumber,
            ),
      ),
    },
  });
  groupById.set('type', {
    id: 'type',
    label: 'Type',
    content: {
      kind: 'fields',
      fields: [propertyStateToInspectorField('type', 'Type', typeAndInstance.type, (v) => v.name)],
    },
  });
  groupById.set('instance', {
    id: 'instance',
    label: 'Instance',
    content: {
      kind: 'lines',
      lines:
        typeAndInstance.overriddenPropertyKeys.length === 0
          ? []
          : typeAndInstance.overriddenPropertyKeys.map((key) => `Overridden: ${key}`),
    },
  });
  groupById.set('relationships', {
    id: 'relationships',
    label: 'Relationships',
    content: {
      kind: 'fields',
      fields: relationships.relationships.map((entry) =>
        propertyStateToInspectorField(entry.key, entry.key, entry.relatedIds, formatIds),
      ),
    },
  });
  groupById.set('warnings', {
    id: 'warnings',
    label: 'Warnings',
    content: { kind: 'lines', lines: warnings.messages.map((m) => `${m.severity}: ${m.title}`) },
  });
  groupById.set('history', {
    id: 'history',
    label: 'History',
    content: {
      kind: 'lines',
      lines: history.entries.map((entry) => `${entry.type} (${entry.timestamp})`),
    },
  });

  return Array.from(groupById.values());
}
