import { describe, expect, it } from 'vitest';
import {
  buildGeometryPropertyGroup,
  buildIdentityPropertyGroup,
  buildRelationshipsPropertyGroup,
  buildTypeAndInstancePropertyGroup,
  calculatedProperty,
  elementId,
  inheritedProperty,
  lengthMeasurement,
  length,
  missingRelationshipEntry,
  overriddenProperty,
  relationshipEntry,
  type NamedPropertyState,
} from '@arq/bim-core';
import { buildWarningsPropertyGroup } from './warnings-property-group';
import { explainSelection } from './explain-selection';
import type { ValidationMessage } from './validation-result';

const wall1 = elementId('wall-1');

describe('explainSelection', () => {
  it('composes what the object is, inherited/overridden properties, host, relationships and warnings', () => {
    const identity = buildIdentityPropertyGroup({
      id: 'door-1',
      category: 'Door',
      type: { id: 'dt-1', name: 'Single Door 900mm' },
    });
    const geometry = buildGeometryPropertyGroup([
      lengthMeasurement('width', inheritedProperty(length(900, 'mm'), 'dt-1')),
      lengthMeasurement('height', overriddenProperty(length(2200, 'mm'), 'dt-1')),
    ]);
    const namedProperties: NamedPropertyState[] = [
      { key: 'width', state: inheritedProperty(length(900, 'mm'), 'dt-1') },
      { key: 'height', state: overriddenProperty(length(2200, 'mm'), 'dt-1') },
    ];
    const typeAndInstance = buildTypeAndInstancePropertyGroup(
      { id: 'dt-1', name: 'Single Door 900mm' },
      namedProperties,
    );
    const relationships = buildRelationshipsPropertyGroup([
      relationshipEntry('host', 'hostedBy', ['wall-1']),
      relationshipEntry('boundaryElements', 'references', ['room-1']),
    ]);
    const messages: ValidationMessage[] = [
      {
        id: 'm1',
        severity: 'warning',
        code: 'OVERLAP',
        title: 'Overlaps another opening',
        explanation: 'detail',
        affectedElementIds: [wall1],
        suggestedActions: [],
      },
    ];
    const warnings = buildWarningsPropertyGroup(wall1, messages);

    const explanation = explainSelection(
      identity,
      geometry,
      typeAndInstance,
      namedProperties,
      relationships,
      warnings,
    );

    expect(explanation).toEqual({
      summary: 'Door, Single Door 900mm, width 900mm, height 2200mm, 1 warning',
      inheritedProperties: ['width'],
      overriddenProperties: ['height'],
      host: 'wall-1',
      relationships: [{ key: 'boundaryElements', relatedIds: ['room-1'] }],
      warnings: ['Overlaps another opening'],
    });
  });

  it('reports host as null when the element has no hostedBy relationship (e.g. a Wall)', () => {
    const identity = buildIdentityPropertyGroup({ id: 'wall-1', category: 'Wall' });
    const geometry = buildGeometryPropertyGroup([]);
    const typeAndInstance = buildTypeAndInstancePropertyGroup(undefined, []);
    const relationships = buildRelationshipsPropertyGroup([
      missingRelationshipEntry('host', 'hostedBy'),
    ]);
    const warnings = buildWarningsPropertyGroup(wall1, []);

    const explanation = explainSelection(
      identity,
      geometry,
      typeAndInstance,
      [],
      relationships,
      warnings,
    );

    expect(explanation.host).toBeNull();
    expect(explanation.relationships).toEqual([]);
  });

  it('omits a relationship entry with an empty related-ids list', () => {
    const identity = buildIdentityPropertyGroup({ id: 'wall-1', category: 'Wall' });
    const geometry = buildGeometryPropertyGroup([]);
    const typeAndInstance = buildTypeAndInstancePropertyGroup(undefined, []);
    const relationships = buildRelationshipsPropertyGroup([
      relationshipEntry('hostedOpenings', 'hosts', []),
    ]);
    const warnings = buildWarningsPropertyGroup(wall1, []);

    const explanation = explainSelection(
      identity,
      geometry,
      typeAndInstance,
      [],
      relationships,
      warnings,
    );

    expect(explanation.relationships).toEqual([]);
  });

  it('lists warning titles in full, not just a count', () => {
    const identity = buildIdentityPropertyGroup({ id: 'wall-1', category: 'Wall' });
    const geometry = buildGeometryPropertyGroup([]);
    const typeAndInstance = buildTypeAndInstancePropertyGroup(undefined, []);
    const relationships = buildRelationshipsPropertyGroup([]);
    const messages: ValidationMessage[] = [
      {
        id: 'm1',
        severity: 'error',
        code: 'X',
        title: 'First warning',
        explanation: 'detail',
        affectedElementIds: [wall1],
        suggestedActions: [],
      },
      {
        id: 'm2',
        severity: 'warning',
        code: 'Y',
        title: 'Second warning',
        explanation: 'detail',
        affectedElementIds: [wall1],
        suggestedActions: [],
      },
    ];
    const warnings = buildWarningsPropertyGroup(wall1, messages);

    const explanation = explainSelection(
      identity,
      geometry,
      typeAndInstance,
      [],
      relationships,
      warnings,
    );

    expect(explanation.warnings).toEqual(['First warning', 'Second warning']);
  });

  it('reports no inherited or overridden properties when every property is merely calculated', () => {
    const identity = buildIdentityPropertyGroup({ id: 'room-1', category: 'Room' });
    const geometry = buildGeometryPropertyGroup([]);
    const namedProperties: NamedPropertyState[] = [
      { key: 'area', state: calculatedProperty(12.5) },
    ];
    const typeAndInstance = buildTypeAndInstancePropertyGroup(undefined, namedProperties);
    const relationships = buildRelationshipsPropertyGroup([]);
    const warnings = buildWarningsPropertyGroup(wall1, []);

    const explanation = explainSelection(
      identity,
      geometry,
      typeAndInstance,
      namedProperties,
      relationships,
      warnings,
    );

    expect(explanation.inheritedProperties).toEqual([]);
    expect(explanation.overriddenProperties).toEqual([]);
  });
});
