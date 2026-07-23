import { describe, expect, it } from 'vitest';
import {
  buildGeometryPropertyGroup,
  buildIdentityPropertyGroup,
  calculatedProperty,
  inheritedProperty,
  lengthMeasurement,
  length,
  missingProperty,
} from '@arq/bim-core';
import { elementId } from '@arq/bim-core';
import { buildWarningsPropertyGroup } from './warnings-property-group';
import { describeSelectedElementForAccessibility } from './accessible-selection-description';
import type { ValidationMessage } from './validation-result';

const wall1 = elementId('wall-1');

describe('describeSelectedElementForAccessibility', () => {
  it('describes category, name, geometry and a plural warning count', () => {
    const identity = buildIdentityPropertyGroup({
      id: 'wall-1',
      category: 'Wall',
      type: { id: 'wt-1', name: 'Interior Wall 100mm' },
    });
    const geometry = buildGeometryPropertyGroup([
      lengthMeasurement('height', inheritedProperty(length(2400, 'mm'), 'wt-1')),
      lengthMeasurement('length', calculatedProperty(length(4000, 'mm'))),
    ]);
    const messages: ValidationMessage[] = [
      {
        id: 'm1',
        severity: 'error',
        code: 'X',
        title: 'X',
        explanation: 'X',
        affectedElementIds: [wall1],
        suggestedActions: [],
      },
      {
        id: 'm2',
        severity: 'warning',
        code: 'Y',
        title: 'Y',
        explanation: 'Y',
        affectedElementIds: [wall1],
        suggestedActions: [],
      },
    ];
    const warnings = buildWarningsPropertyGroup(wall1, messages);

    const description = describeSelectedElementForAccessibility(identity, geometry, warnings);
    expect(description).toBe('Wall, Interior Wall 100mm, height 2400mm, length 4000mm, 2 warnings');
  });

  it('uses a singular "warning" for exactly one warning', () => {
    const identity = buildIdentityPropertyGroup({ id: 'room-1', category: 'Room' });
    const geometry = buildGeometryPropertyGroup([]);
    const messages: ValidationMessage[] = [
      {
        id: 'm1',
        severity: 'warning',
        code: 'Y',
        title: 'Y',
        explanation: 'Y',
        affectedElementIds: [wall1],
        suggestedActions: [],
      },
    ];
    const warnings = buildWarningsPropertyGroup(wall1, messages);

    expect(describeSelectedElementForAccessibility(identity, geometry, warnings)).toBe(
      'Room, 1 warning',
    );
  });

  it('omits the warning count entirely when there are none', () => {
    const identity = buildIdentityPropertyGroup({ id: 'room-1', category: 'Room' });
    const geometry = buildGeometryPropertyGroup([]);
    const warnings = buildWarningsPropertyGroup(wall1, []);
    expect(describeSelectedElementForAccessibility(identity, geometry, warnings)).toBe('Room');
  });

  it('omits a missing name rather than announcing "missing" or "unknown"', () => {
    const identity = buildIdentityPropertyGroup({ id: 'wall-1', category: 'Wall' });
    const geometry = buildGeometryPropertyGroup([]);
    const warnings = buildWarningsPropertyGroup(wall1, []);
    expect(describeSelectedElementForAccessibility(identity, geometry, warnings)).toBe('Wall');
  });

  it('omits a missing geometry measurement', () => {
    const identity = buildIdentityPropertyGroup({ id: 'opening-1', category: 'Opening' });
    const geometry = buildGeometryPropertyGroup([
      lengthMeasurement('width', missingProperty()),
      lengthMeasurement('height', calculatedProperty(length(2100, 'mm'))),
    ]);
    const warnings = buildWarningsPropertyGroup(wall1, []);
    expect(describeSelectedElementForAccessibility(identity, geometry, warnings)).toBe(
      'Opening, height 2100mm',
    );
  });

  it('formats area and angle measurements as plain numbers, without a unit suffix', () => {
    const identity = buildIdentityPropertyGroup({ id: 'room-1', category: 'Room' });
    const geometry = buildGeometryPropertyGroup([
      { key: 'area', quantity: 'area', state: calculatedProperty(12.5) },
    ]);
    const warnings = buildWarningsPropertyGroup(wall1, []);
    expect(describeSelectedElementForAccessibility(identity, geometry, warnings)).toBe(
      'Room, area 12.5',
    );
  });
});
